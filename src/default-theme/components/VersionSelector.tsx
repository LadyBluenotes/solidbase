import { Show } from "solid-js";

import { useLocale, type VersionOption } from "../../client/index.jsx";
import styles from "./ThemeSelector.module.css";

export default function VersionSelector<ThemeConfig>() {
	const { versions, currentVersion, setVersion } = useLocale();
	const currentValue = () =>
		getVersionValue(currentVersion() as VersionOption<any>);

	return (
		<Show when={versions.length > 1}>
			<label class={styles.trigger}>
				<span>Version:</span>
				<select
					value={currentValue()}
					onChange={(event) => {
						const next = versions.find(
							(version) =>
								getVersionValue(version) === event.currentTarget.value,
						);

						if (next) setVersion(next as VersionOption<ThemeConfig>);
					}}
				>
					{versions.map((version) => (
						<option value={getVersionValue(version)}>{version.label}</option>
					))}
				</select>
			</label>
		</Show>
	);
}

function getVersionValue(version: VersionOption<any>) {
	return version.isLatest ? "latest" : version.path;
}
