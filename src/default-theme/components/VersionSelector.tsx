import { Select } from "@kobalte/core/select";
import { For, Show } from "solid-js";

import {
	type ExternalVersionOption,
	type InternalVersionOption,
	useLocale,
} from "../../client/index.jsx";
import styles from "./ThemeSelector.module.css";

export default function VersionSelector<ThemeConfig>() {
	const { versions, externalVersions, currentVersion, setVersion } =
		useLocale();
	const currentValue = () =>
		getVersionValue(currentVersion() as InternalVersionOption<any>);

	return (
		<Show when={versions.length > 1 || externalVersions.length > 0}>
			<div class={styles.root}>
				<Show when={versions.length > 1}>
					<Select<InternalVersionOption<ThemeConfig>>
						class={styles.root}
						value={currentVersion() as InternalVersionOption<ThemeConfig>}
						options={versions as InternalVersionOption<ThemeConfig>[]}
						optionValue={(version) => getVersionValue(version)}
						optionTextValue={(version) => version.label}
						allowDuplicateSelectionEvents
						onChange={(option) => option && setVersion(option)}
						gutter={8}
						sameWidth={false}
						placement="bottom"
						itemComponent={(props) => (
							<Select.Item class={styles.item} item={props.item}>
								<Select.ItemLabel>{props.item.rawValue.label}</Select.ItemLabel>
							</Select.Item>
						)}
					>
						<Select.Trigger class={styles.trigger} aria-label="change version">
							<Select.Value<InternalVersionOption<ThemeConfig>>>
								{(state) => state.selectedOption().label}
							</Select.Value>
						</Select.Trigger>
						<Select.Portal>
							<Select.Content class={styles.content}>
								<Select.Listbox class={styles.list} />
							</Select.Content>
						</Select.Portal>
					</Select>
				</Show>
				<Show when={externalVersions.length > 0}>
					<div class={styles.icon}>
						<For each={externalVersions}>
							{(version) => (
								<a
									href={version.href}
									target="_blank"
									rel="noreferrer noopener"
								>
									{version.label}
								</a>
							)}
						</For>
					</div>
				</Show>
			</div>
		</Show>
	);
}

function getVersionValue(version: InternalVersionOption<any>) {
	return version.isLatest ? "latest" : version.path;
}
