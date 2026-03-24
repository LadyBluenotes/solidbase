import { useLocale } from "@kobalte/solidbase/client";
import Layout from "@kobalte/solidbase/default-theme/Layout.jsx";
import { Title } from "@solidjs/meta";
import type { ParentProps } from "solid-js";

export default function (props: ParentProps) {
	const locale = useLocale();
	const currentVersion = () => locale.currentVersion() as any;
	const currentLocale = () => locale.currentLocale() as any;
	const versions = () => locale.versions as any[];

	return (
		<>
			<Title>I am the captain now</Title>
			<div class="dev-versioning-panel">
				<p>
					<strong>Dev versioning tester</strong>
					<span>
						Current version: {currentVersion().label} | Current locale:{" "}
						{String(currentLocale().config.label)}
					</span>
				</p>
				<label>
					<span>Switch version</span>
					<select
						value={currentVersion().isLatest ? "latest" : currentVersion().path}
						onChange={(event) => {
							const next = versions().find(
								(version) =>
									(version.isLatest ? "latest" : version.path) ===
									event.currentTarget.value,
							);

							if (next) locale.setVersion(next);
						}}
					>
						{versions().map((version) => (
							<option value={version.isLatest ? "latest" : version.path}>
								{version.label}
							</option>
						))}
					</select>
				</label>
			</div>
			<Layout>{props.children}</Layout>
		</>
	);
}
