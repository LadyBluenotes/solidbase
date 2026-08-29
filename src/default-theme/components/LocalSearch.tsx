import { Dialog } from "@kobalte/core/dialog";
import { Search } from "@kobalte/core/search";
import { useLocation, useNavigate } from "@solidjs/router";
import type MiniSearch from "minisearch";
import type { SearchResult } from "minisearch";
import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import IconCloseLine from "~icons/ri/close-line";
import IconSearchLine from "~icons/ri/search-line";
import { useRouteSolidBaseConfig } from "../../client/config.js";
import type { DefaultThemeConfig } from "../index.js";
import {
	getLocalSearchScopeForPath,
	LOCAL_SEARCH_INDEX_OPTIONS,
	LOCAL_SEARCH_QUERY_OPTIONS,
	type LocalSearchDocument,
} from "../search.js";
import { defaultThemeTextConfig } from "../text.js";
import styles from "./LocalSearch.module.css";

type LocalSearchHit = SearchResult &
	Pick<LocalSearchDocument, "title" | "titles" | "excerpt">;

type LocalSearchIndexState =
	| { status: "idle" }
	| { status: "loading" }
	| {
			status: "ready";
			scope: string;
			index: MiniSearch<LocalSearchDocument>;
	  }
	| { status: "error" };

export default function LocalSearch(props: { shortcut?: boolean }) {
	const config = useRouteSolidBaseConfig<DefaultThemeConfig>();
	const location = useLocation();
	const navigate = useNavigate();
	const text = {
		...defaultThemeTextConfig,
		...config().themeConfig?.text,
	};
	const [open, setOpen] = createSignal(false);
	const [query, setQuery] = createSignal("");
	const [indexState, setIndexState] = createSignal<LocalSearchIndexState>({
		status: "idle",
	});
	let inputRef: HTMLInputElement | undefined;
	let requestId = 0;

	const scope = () => getLocalSearchScopeForPath(location.pathname, config());
	const results = createMemo<LocalSearchHit[]>(() => {
		const value = query();
		const state = indexState();
		if (!value || state.status !== "ready" || state.scope !== scope())
			return [];

		return state.index
			.search(value, LOCAL_SEARCH_QUERY_OPTIONS)
			.slice(0, 10) as LocalSearchHit[];
	});

	async function loadIndex() {
		const nextScope = scope();
		const state = indexState();
		if (state.status === "ready" && state.scope === nextScope) return;
		const currentRequest = ++requestId;
		setIndexState({ status: "loading" });

		try {
			const [{ default: MiniSearch }, { default: indexes }] = await Promise.all(
				[import("minisearch"), import("virtual:solidbase/local-search")],
			);
			const serialized = indexes[nextScope];
			if (!serialized)
				throw new Error(`Missing local search index for ${nextScope}`);
			if (currentRequest !== requestId) return;
			setIndexState({
				status: "ready",
				scope: nextScope,
				index: MiniSearch.loadJSON(serialized, LOCAL_SEARCH_INDEX_OPTIONS),
			});
		} catch {
			if (currentRequest === requestId) {
				setIndexState({ status: "error" });
			}
		}
	}

	function onOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		if (nextOpen) {
			void loadIndex();
		} else {
			setQuery("");
		}
	}

	onMount(() => {
		if (!props.shortcut) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.key.toLowerCase() !== "k" ||
				!(event.metaKey || event.ctrlKey)
			) {
				return;
			}
			event.preventDefault();
			onOpenChange(true);
		};

		document.addEventListener("keydown", onKeyDown);
		onCleanup(() => document.removeEventListener("keydown", onKeyDown));
	});

	return (
		<Dialog open={open()} onOpenChange={onOpenChange}>
			<Dialog.Trigger
				type="button"
				class={styles.trigger}
				aria-label={text.search}
				aria-keyshortcuts={props.shortcut ? "Meta+K Control+K" : undefined}
			>
				<IconSearchLine aria-hidden />
				<span>{text.search}</span>
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay class={styles.overlay} />
				<Dialog.Content
					role="dialog"
					class={styles.dialog}
					onOpenAutoFocus={(event) => {
						event.preventDefault();
						queueMicrotask(() => inputRef?.focus());
					}}
				>
					<div class={styles.header}>
						<Dialog.Title class={styles.title}>{text.search}</Dialog.Title>
						<Dialog.CloseButton
							class={styles.close}
							aria-label={text.searchClose}
						>
							<IconCloseLine aria-hidden />
						</Dialog.CloseButton>
					</div>
					<Search<LocalSearchHit>
						open
						modal={false}
						options={results()}
						optionValue="id"
						optionTextValue="title"
						optionLabel="title"
						placeholder={text.searchPlaceholder}
						onInputChange={setQuery}
						onChange={(result) => {
							if (!result) return;
							onOpenChange(false);
							void navigate(result.id);
						}}
						itemComponent={(props) => (
							<Search.Item class={styles.item} item={props.item}>
								<Search.ItemLabel class={styles["item-title"]}>
									{props.item.rawValue.title}
								</Search.ItemLabel>
								<Show when={props.item.rawValue.titles.length > 0}>
									<div class={styles.path}>
										{props.item.rawValue.titles.join(" › ")}
									</div>
								</Show>
								<Show when={props.item.rawValue.excerpt}>
									<div class={styles.excerpt}>
										{props.item.rawValue.excerpt}
									</div>
								</Show>
							</Search.Item>
						)}
					>
						<Search.Label class={styles.label}>{text.search}</Search.Label>
						<Search.Control class={styles.control}>
							<IconSearchLine aria-hidden />
							<Search.Input ref={inputRef} class={styles.input} />
						</Search.Control>
						<div class={styles.content}>
							<Show when={indexState().status === "loading"}>
								<div class={styles.status} role="status">
									{text.searchLoading}
								</div>
							</Show>
							<Show when={indexState().status === "error"}>
								<div class={styles.status} role="alert">
									{text.searchUnavailable}
								</div>
							</Show>
							<Show when={indexState().status === "ready" && query()}>
								<Search.NoResult class={styles.status} role="status">
									{text.searchNoResults}
								</Search.NoResult>
							</Show>
							<Search.Listbox class={styles.list} />
						</div>
					</Search>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog>
	);
}
