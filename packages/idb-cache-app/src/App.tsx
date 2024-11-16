import "./App.css";
import { IDBCache } from "@instructure/idb-cache";
import { useCallback, useRef, useState, useEffect } from "react";
import { deterministicHash, generateTextOfSize } from "./utils";
import { Button } from "@instructure/ui-buttons";
import { Metric } from "@instructure/ui-metric";
import { View } from "@instructure/ui-view";
import { Flex } from "@instructure/ui-flex";
import { Heading } from "@instructure/ui-heading";
import { NumberInput } from "@instructure/ui-number-input";
import GitHubLink from "./components/GitHubLink";
import BlankStat from "./components/BlankStat";

// For demonstration/testing purposes.
// Do *not* store cacheKey to localStorage in production.
let cacheKey: string = localStorage.cacheKey;
if (!cacheKey) {
	cacheKey = crypto.randomUUID();
	localStorage.cacheKey = cacheKey;
}

let cacheBuster: string = localStorage.cacheBuster;
if (!cacheBuster) {
	cacheBuster = crypto.randomUUID();
	localStorage.cacheBuster = cacheBuster;
}

const cache = new IDBCache({
	cacheKey,
	cacheBuster,
	debug: true,
});
// @ts-expect-error
window.idbCacheInstance = cache;

const DEFAULT_NUM_ITEMS = 1;

// Default item size set to 32KB
const DEFAULT_ITEM_SIZE = 1024 * 32;

const getInitialItemSize = () => {
	const params = new URLSearchParams(window.location.hash.slice(1));
	const sizeParam = params.get("size");
	const sizeInKB = Number.parseInt(sizeParam ?? "0", 10);

	if (!Number.isNaN(sizeInKB) && sizeInKB > 0) {
		return sizeInKB * 1024;
	}

	return DEFAULT_ITEM_SIZE;
};

const App = () => {
	const [hash1, setHash1] = useState<string | null>(null);
	const [hash2, setHash2] = useState<string | null>(null);
	const [timeToGenerate, setTimeToGenerate] = useState<number | null>(null);
	const [setTime, setSetTime] = useState<number | null>(null);
	const [getTime, setGetTime] = useState<number | null>(null);
	const [countTime, setCountTime] = useState<number | null>(null);
	const [clearTime, setClearTime] = useState<number | null>(null);

	const [itemSize, setItemSize] = useState<number>(getInitialItemSize());
	const [itemCount, setItemCount] = useState<number | null>(null);

	useEffect(() => {
		const params = new URLSearchParams(window.location.hash.slice(1));
		params.set("size", String(Math.round(itemSize / 1024)));
		window.location.hash = `#${params.toString()}`;
	}, [itemSize]);

	const keyCounter = useRef(0);
	const [contentKey, saveContentKey] = useState<string>(() =>
		deterministicHash(`initial-seed-${keyCounter.current}`),
	);

	const encryptAndStore = useCallback(async () => {
		const key = deterministicHash(`seed-${keyCounter.current}`);
		keyCounter.current += 1;
		saveContentKey(key);

		const start1 = performance.now();
		const paragraphs = Array.from({ length: DEFAULT_NUM_ITEMS }, (_, index) =>
			generateTextOfSize(itemSize, `${key}-${index}`),
		);
		const end1 = performance.now();
		setTimeToGenerate(end1 - start1);

		const start2 = performance.now();

		for (let i = 0; i < DEFAULT_NUM_ITEMS; i++) {
			await cache.setItem(`item-${key}-${i}`, paragraphs[i]);
		}

		const end2 = performance.now();
		setSetTime(end2 - start2);

		setHash1(deterministicHash(paragraphs.join("")));
	}, [itemSize]);

	const retrieveAndDecrypt = useCallback(async () => {
		const results: Array<string | null> = [];
		const start = performance.now();

		for (let i = 0; i < DEFAULT_NUM_ITEMS; i++) {
			const result = await cache.getItem(`item-${contentKey}-${i}`);
			results.push(result);
		}

		const end = performance.now();
		setGetTime(end - start);
		setHash2(
			results.filter((x) => x).length > 0
				? deterministicHash(results.join(""))
				: null,
		);
	}, [contentKey]);

	const count = useCallback(async () => {
		const start = performance.now();
		const count = await cache.count();
		const end = performance.now();
		setCountTime(end - start);
		setItemCount(count);
	}, []);

	const clear = useCallback(async () => {
		const start = performance.now();
		await cache.clear();
		const end = performance.now();
		setClearTime(end - start);
	}, []);

	return (
		<>
			<GitHubLink />

			<div className="min-h-screen bg-gray-50 p-8">
				<div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg">
					<Heading level="h1" margin="0 0 small 0">
						@instructure/idb-cache
					</Heading>

					<form>
						<fieldset className="border border-gray-300 rounded-lg p-4 mb-6">
							<legend className="text-lg font-semibold text-gray-700">
								Test Configuration
							</legend>
							<Flex direction="column" gap="small">
								<div className="flex items-center justify-between">
									<span>
										Cache key: <code className="text-sm">{cacheKey}</code>
									</span>
									<Button
										data-testid="reset-cacheKey"
										onClick={() => {
											localStorage.removeItem("cacheKey");
											window.location.reload();
										}}
									>
										Reset
									</Button>
								</div>
								<div className="flex items-center justify-between">
									<span>
										Cache buster: <code className="text-sm">{cacheBuster}</code>
									</span>
									<Button
										data-testid="reset-cacheBuster"
										onClick={() => {
											localStorage.removeItem("cacheBuster");
											window.location.reload();
										}}
									>
										Reset
									</Button>
								</div>

								<Flex gap="medium">
									<Flex.Item shouldGrow>
										<NumberInput
											renderLabel="Size of data (KB):"
											onChange={(e) => {
												const newValue = Math.max(
													Number.parseInt(e.target.value, 10) * 1024,
													1024,
												);
												setItemSize(newValue);
											}}
											onIncrement={() => {
												setItemSize((prev) => Math.max(prev + 1024, 1024));
											}}
											onDecrement={() => {
												setItemSize((prev) => Math.max(prev - 1024, 1024));
											}}
											isRequired
											value={Math.round(itemSize / 1024)} // Display in KB
										/>
									</Flex.Item>
									<Flex.Item shouldGrow>
										<NumberInput
											renderLabel="Number of chunks:"
											interaction="disabled"
											value={Math.ceil(itemSize / 25000)}
										/>
									</Flex.Item>
								</Flex>
							</Flex>
						</fieldset>

						<fieldset className="border border-gray-300 rounded-lg p-4">
							<legend className="text-lg font-semibold text-gray-700">
								Performance Tests
							</legend>
							<div className="flex flex-col gap-4">
								{/* setItem Performance */}
								<View
									as="span"
									display="inline-block"
									margin="none"
									padding="medium"
									background="primary"
									shadow="resting"
								>
									<Flex direction="column">
										<Button
											data-testid="set-item-button"
											color="primary"
											onClick={encryptAndStore}
										>
											setItem
										</Button>
										<View padding="medium 0 0 0">
											<Flex>
												<Flex.Item size="33.3%">
													<Metric
														renderLabel="Generate Test Data"
														data-testid="generate-time"
														renderValue={
															timeToGenerate !== null ? (
																`${Math.round(timeToGenerate)} ms`
															) : (
																<BlankStat />
															)
														}
													/>
												</Flex.Item>
												<Flex.Item shouldGrow>
													<Metric
														renderLabel="setItem"
														data-testid="set-time"
														renderValue={
															setTime !== null ? (
																`${Math.round(setTime)} ms`
															) : (
																<BlankStat />
															)
														}
													/>
												</Flex.Item>
												<Flex.Item size="33.3%">
													<Metric
														data-testid="hash1"
														renderLabel="Hash"
														renderValue={hash1 || <BlankStat />}
													/>
												</Flex.Item>
											</Flex>
										</View>
									</Flex>
								</View>

								{/* getItem Performance */}
								<View
									as="span"
									display="inline-block"
									margin="none"
									padding="medium"
									background="primary"
									shadow="resting"
								>
									<Flex direction="column">
										<Button
											data-testid="get-item-button"
											color="primary"
											onClick={retrieveAndDecrypt}
										>
											getItem
										</Button>

										<View padding="medium 0 0 0">
											<Flex>
												<Flex.Item size="33.3%">&nbsp;</Flex.Item>
												<Flex.Item shouldGrow>
													<Metric
														renderLabel="getItem"
														data-testid="get-time"
														renderValue={
															getTime !== null ? (
																`${Math.round(getTime)} ms`
															) : (
																<BlankStat />
															)
														}
													/>
												</Flex.Item>
												<Flex.Item size="33.3%">
													<Metric
														renderLabel="Hash"
														data-testid="hash2"
														renderValue={hash2 || <BlankStat />}
													/>
												</Flex.Item>
											</Flex>
										</View>
									</Flex>
								</View>

								{/* count Performance */}
								<View
									as="span"
									display="inline-block"
									margin="none"
									padding="medium"
									background="primary"
									shadow="resting"
								>
									<Flex direction="column">
										<Button
											data-testid="count-button"
											color="primary"
											onClick={count}
										>
											count
										</Button>

										<View padding="medium 0 0 0">
											<Flex>
												<Flex.Item size="33.3%">&nbsp;</Flex.Item>
												<Flex.Item shouldGrow>
													<Metric
														data-testid="count-time"
														renderLabel="count"
														renderValue={
															countTime !== null ? (
																`${Math.round(countTime)} ms`
															) : (
																<BlankStat />
															)
														}
													/>
												</Flex.Item>
												<Flex.Item size="33.3%">
													<Metric
														renderLabel="Chunks"
														data-testid="count-value"
														renderValue={
															typeof itemCount === "number" ? (
																itemCount
															) : (
																<BlankStat />
															)
														}
													/>
												</Flex.Item>
											</Flex>
										</View>
									</Flex>
								</View>

								{/* clear Performance */}
								<View
									as="span"
									display="inline-block"
									margin="none"
									padding="medium"
									background="primary"
									shadow="resting"
								>
									<Flex direction="column">
										<Button
											data-testid="clear-button"
											color="primary"
											onClick={clear}
										>
											clear
										</Button>

										<View padding="medium 0 0 0">
											<Flex>
												<Flex.Item size="33.3%">&nbsp;</Flex.Item>
												<Flex.Item shouldGrow>
													<Metric
														renderLabel="clear"
														data-testid="clear-time"
														renderValue={
															clearTime !== null ? (
																`${Math.round(clearTime)} ms`
															) : (
																<BlankStat />
															)
														}
													/>
												</Flex.Item>
												<Flex.Item size="33.3%">&nbsp;</Flex.Item>
											</Flex>
										</View>
									</Flex>
								</View>
							</div>
						</fieldset>
					</form>
				</div>
			</div>
		</>
	);
};

export default App;
