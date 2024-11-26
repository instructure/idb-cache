import "./App.css";
// import { IDBCache } from "@instructure/idb-cache";
import { IDBCache } from "../../idb-cache/dist";
import { useCallback, useRef, useState, useEffect } from "react";
import { deterministicHash } from "./utils";
import { Button } from "@instructure/ui-buttons";
import { Metric } from "@instructure/ui-metric";
import { View } from "@instructure/ui-view";
import { Flex } from "@instructure/ui-flex";
import { Heading } from "@instructure/ui-heading";
import { NumberInput } from "@instructure/ui-number-input";
import GitHubLink from "./components/GitHubLink";
import BlankStat from "./components/BlankStat";
import { CacheKey } from "./components/CacheKey";
import { CacheBuster } from "./components/CacheBuster";
import {
	WrappedFlexContainer,
	WrappedFlexItem,
} from "./components/WrappedFlexItem";
import { Test } from "./components/Test";
import { generateTextOfSize } from "./fixtures";
import { RadioInputGroup, RadioInput } from "@instructure/ui-radio-input";
import { IconInfoLine } from "@instructure/ui-icons";
import { Tooltip } from "@instructure/ui-tooltip";

const DEFAULT_NUM_ITEMS = 1;
const DEFAULT_ITEM_SIZE = 1024 * 32; // 32KiB
const DEFAULT_CHUNK_SIZE = 1024 * 25; // 25 KiB
const DEFAULT_MAX_CHUNKS_STORED = 5000;

// For demonstration/testing purposes.
// Do *not* store cacheKey to localStorage in production.
let initialCacheKey: string = localStorage.cacheKey;
if (!initialCacheKey) {
	initialCacheKey = crypto.randomUUID();
	localStorage.cacheKey = initialCacheKey;
}

let initialCacheBuster: string = localStorage.cacheBuster;
if (!initialCacheBuster) {
	initialCacheBuster = crypto.randomUUID();
	localStorage.cacheBuster = initialCacheBuster;
}

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
	const [setTime, setSetItemTime] = useState<number | null>(null);
	const [getTime, setGetItemTime] = useState<number | null>(null);
	const [countTime, setCountTime] = useState<number | null>(null);
	const [cleanupTime, setCleanupTime] = useState<number | null>(null);
	const [clearTime, setClearTime] = useState<number | null>(null);

	const [itemSize, setItemSize] = useState<number>(getInitialItemSize());
	const [chunkSize, setChunkSize] = useState<number>(DEFAULT_CHUNK_SIZE);
	const [itemCount, setItemCount] = useState<number | null>(null);
	const [maxTotalChunksStored, setMaxTotalChunksStored] = useState<number>(
		() => {
			const stored = localStorage.maxTotalChunksStored;
			return stored ? Number.parseInt(stored, 10) : DEFAULT_MAX_CHUNKS_STORED;
		},
	);
	const [priority, setPriority] = useState<"normal" | "low">(() => {
		const stored = localStorage.priority;
		return ["normal", "low"].includes(stored) ? stored : "normal";
	});

	const [cacheReady, setCacheReady] = useState<boolean>(false);

	useEffect(() => {
		const params = new URLSearchParams(window.location.hash.slice(1));
		params.set("size", String(Math.round(itemSize / 1024)));
		window.location.hash = `#${params.toString()}`;
	}, [itemSize]);

	const keyCounter = useRef(
		Number.parseInt(localStorage.getItem("keyCounter") || "0") || 0,
	);
	const [contentKey, saveContentKey] = useState<string>(() =>
		deterministicHash(`seed-${keyCounter.current}`),
	);

	const cacheRef = useRef<IDBCache | null>(null);

	useEffect(() => {
		let isCancelled = false;

		const initializeCache = async () => {
			if (cacheRef.current) {
				setCacheReady(false);
				try {
					await cacheRef.current.destroy();
				} catch (error) {
					console.error("Error destroying previous cache:", error);
				}
			}

			try {
				const newCache = new IDBCache({
					cacheKey: initialCacheKey,
					cacheBuster: initialCacheBuster,
					debug: true,
					chunkSize: chunkSize,
					maxTotalChunks: maxTotalChunksStored,
					priority,
				});

				if (!isCancelled) {
					cacheRef.current = newCache;
					setCacheReady(true);
				} else {
					await newCache.destroy();
				}
			} catch (error) {
				console.error("Error initializing cache:", error);
				if (!isCancelled) {
					setCacheReady(false);
				}
			}
		};

		initializeCache();

		return () => {
			isCancelled = true;
			if (cacheRef.current) {
				cacheRef.current.destroy().catch((error) => {
					console.error("Error destroying cache on cleanup:", error);
				});
				cacheRef.current = null;
				setCacheReady(false);
			}
		};
	}, [chunkSize, maxTotalChunksStored, priority]);

	useEffect(() => {
		localStorage.setItem("maxTotalChunksStored", String(maxTotalChunksStored));
	}, [maxTotalChunksStored]);

	useEffect(() => {
		localStorage.setItem("priority", String(priority));
	}, [priority]);

	const encryptAndStore = useCallback(async () => {
		const cache = cacheRef.current;
		if (!cache) {
			console.error("Cache is not initialized.");
			return;
		}

		const key = deterministicHash(`seed-${keyCounter.current}`);
		localStorage.setItem("keyCounter", String(keyCounter.current));
		keyCounter.current += 1;
		saveContentKey(key);

		const start1 = performance.now();
		try {
			const paragraphs = await Promise.all(
				Array.from({ length: DEFAULT_NUM_ITEMS }, (_, index) =>
					generateTextOfSize(itemSize, `${key}-${index}`),
				),
			);
			const end1 = performance.now();
			setTimeToGenerate(end1 - start1);

			// for accurate perf measurement
			await new Promise((resolve) => requestAnimationFrame(resolve));

			const start2 = performance.now();

			for (let i = 0; i < DEFAULT_NUM_ITEMS; i++) {
				await cache.setItem(`item-${key}-${i}`, paragraphs[i]);
			}

			const end2 = performance.now();
			setSetItemTime(end2 - start2);

			setHash1(deterministicHash(paragraphs.join("")));
		} catch (error) {
			console.error("Error during text generation and storage:", error);
		}
	}, [itemSize]);

	const retrieveAndDecrypt = useCallback(async () => {
		const cache = cacheRef.current;
		if (!cache) {
			console.error("Cache is not initialized.");
			return;
		}

		try {
			// for accurate perf measurement
			await new Promise((resolve) => requestAnimationFrame(resolve));

			const results: Array<string | null> = [];
			const start = performance.now();

			for (let i = 0; i < DEFAULT_NUM_ITEMS; i++) {
				const result = await cache.getItem(`item-${contentKey}-${i}`);
				results.push(result);
			}

			const end = performance.now();
			setGetItemTime(end - start);
			setHash2(
				results.filter((x) => x).length > 0
					? deterministicHash(results.join(""))
					: null,
			);
		} catch (error) {
			console.error("Error during text retrieval and decryption:", error);
		}
	}, [contentKey]);

	const cleanup = useCallback(async () => {
		const cache = cacheRef.current;
		if (!cache) {
			console.error("Cache is not initialized.");
			return;
		}

		try {
			// for accurate perf measurement
			await new Promise((resolve) => requestAnimationFrame(resolve));

			const start = performance.now();
			await cache.cleanup();
			const end = performance.now();
			setCleanupTime(end - start);
		} catch (error) {
			console.error("Error during cache cleanup:", error);
		}
	}, []);

	const count = useCallback(async () => {
		const cache = cacheRef.current;
		if (!cache) {
			console.error("Cache is not initialized.");
			return;
		}

		try {
			// for accurate perf measurement
			await new Promise((resolve) => requestAnimationFrame(resolve));

			const start = performance.now();
			const count = await cache.count();
			const end = performance.now();
			setCountTime(end - start);
			setItemCount(count);
		} catch (error) {
			console.error("Error during cache count:", error);
		}
	}, []);

	const clear = useCallback(async () => {
		const cache = cacheRef.current;
		if (!cache) {
			console.error("Cache is not initialized.");
			return;
		}

		try {
			// for accurate perf measurement
			await new Promise((resolve) => requestAnimationFrame(resolve));

			const start = performance.now();
			await cache.clear();
			localStorage.removeItem("keyCounter");
			const end = performance.now();
			setClearTime(end - start);
		} catch (error) {
			console.error("Error during cache clear:", error);
		}
	}, []);

	return (
		<>
			<GitHubLink />

			<div className="min-h-screen bg-gray-50 p-8">
				<View as="div" display="block" width="820px" margin="0 auto">
					<h1
						style={{
							fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
							whiteSpace: "nowrap",
							marginBottom: "1rem",
						}}
					>
						@instructure/idb-cache
					</h1>

					<form>
						<WrappedFlexContainer>
							<WrappedFlexItem>
								<CacheKey cacheKey={initialCacheKey} />
							</WrappedFlexItem>
							<WrappedFlexItem>
								<CacheBuster cacheBuster={initialCacheBuster} />
							</WrappedFlexItem>

							<WrappedFlexItem>
								<NumberInput
									data-testid="item-size-input"
									renderLabel={
										<Flex alignItems="end" direction="row">
											<Flex.Item as="div">
												<View margin="0 xx-small 0 0">Item size (KiB)</View>
											</Flex.Item>
											<Tooltip
												color="primary-inverse"
												renderTip="When an item exceeds this size, it splits into multiple chunks."
												offsetY="5px"
											>
												<Flex.Item as="div">
													<IconInfoLine />
												</Flex.Item>
											</Tooltip>
										</Flex>
									}
									onChange={(e) => {
										const newValue = Math.max(
											Number.parseInt(e.target.value || "0", 10) * 1024,
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
									value={Math.round(itemSize / 1024)} // Display in KiB
								/>
							</WrappedFlexItem>
							<WrappedFlexItem>
								<NumberInput
									renderLabel="Chunks per item:"
									interaction="disabled"
									value={Math.ceil(itemSize / chunkSize)}
								/>
							</WrappedFlexItem>

							<WrappedFlexItem>
								<NumberInput
									disabled
									renderLabel="Chunk size (KiB)"
									onChange={(e) => {
										const newValue = Math.max(
											Number.parseInt(e.target.value || "0", 10) * 1024,
											1024,
										);
										setChunkSize(newValue);
									}}
									onIncrement={() => {
										setChunkSize((prev) => Math.max(prev + 1024, 1024));
									}}
									onDecrement={() => {
										setChunkSize((prev) => Math.max(prev - 1024, 1024));
									}}
									value={Math.round(chunkSize / 1024)} // Display in KiB
								/>
							</WrappedFlexItem>

							<WrappedFlexItem>
								<NumberInput
									data-testid="max-chunks-input"
									renderLabel={
										<Flex alignItems="end">
											<Flex.Item as="div">
												<View margin="0 xx-small 0 0">Max total chunks</View>
											</Flex.Item>
											<Tooltip
												color="primary-inverse"
												renderTip="During cleanup, idb-cache removes the oldest surplus chunks."
												offsetY="5px"
											>
												<Flex.Item as="div">
													<IconInfoLine />
												</Flex.Item>
											</Tooltip>
										</Flex>
									}
									onChange={(e) => {
										const newValue =
											Number.parseInt(e.target.value || "0", 10) || 1;
										setMaxTotalChunksStored(newValue);
									}}
									onIncrement={() => {
										setMaxTotalChunksStored((prev) => Math.max(prev + 1, 1));
									}}
									onDecrement={() => {
										setMaxTotalChunksStored((prev) => Math.max(prev - 1, 1));
									}}
									value={maxTotalChunksStored}
								/>
							</WrappedFlexItem>

							<WrappedFlexItem>
								<RadioInputGroup
									name="priority"
									value={priority}
									data-testid="priority-input"
									description={
										<Flex alignItems="end">
											<Flex.Item as="div">
												<View margin="0 xx-small 0 0">Priority</View>
											</Flex.Item>
											<Tooltip
												color="primary-inverse"
												renderTip="Low priority slightly delays start of operations to reduce load on event loop."
												offsetY="5px"
											>
												<Flex.Item as="div">
													<IconInfoLine />
												</Flex.Item>
											</Tooltip>
										</Flex>
									}
									variant="toggle"
									onChange={(e) => {
										setPriority(e.target.value === "low" ? "low" : "normal");
									}}
								>
									<RadioInput label="Normal" value="normal" />
									<RadioInput label="Low" value="low" />
								</RadioInputGroup>
							</WrappedFlexItem>
						</WrappedFlexContainer>

						<Heading level="h2" margin="medium 0 small 0">
							Tests
						</Heading>

						{/* setItem Performance */}
						<Test>
							<Button
								data-testid="set-item-button"
								color="primary"
								onClick={encryptAndStore}
								disabled={!cacheReady}
							>
								setItem
							</Button>
							<View padding="medium 0 0 0">
								<Flex>
									<Flex.Item size="33.3%">
										<Metric
											renderLabel="fixtures"
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
											renderLabel="hash"
											renderValue={hash1 || <BlankStat />}
										/>
									</Flex.Item>
								</Flex>
							</View>
						</Test>

						{/* getItem Performance */}
						<Test>
							<Button
								data-testid="get-item-button"
								color="primary"
								onClick={retrieveAndDecrypt}
								disabled={!cacheReady}
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
											renderLabel="hash"
											data-testid="hash2"
											renderValue={hash2 || <BlankStat />}
										/>
									</Flex.Item>
								</Flex>
							</View>
						</Test>

						{/* count Performance */}
						<Test>
							<Button
								data-testid="count-button"
								color="primary"
								onClick={count}
								disabled={!cacheReady}
							>
								count
							</Button>

							<View padding="medium 0 0 0">
								<Flex>
									<Flex.Item size="33.3%">&nbsp;</Flex.Item>
									<Flex.Item shouldGrow>
										<Metric
											renderLabel="count"
											data-testid="count-time"
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
											renderLabel="chunks"
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
						</Test>

						{/* cleanup Performance */}
						<Test>
							<Button
								data-testid="cleanup-button"
								color="primary"
								onClick={cleanup}
								disabled={!cacheReady}
							>
								cleanup
							</Button>

							<View padding="medium 0 0 0">
								<Flex>
									<Flex.Item size="33.3%">&nbsp;</Flex.Item>
									<Flex.Item shouldGrow>
										<Metric
											renderLabel="cleanup"
											data-testid="cleanup-time"
											renderValue={
												cleanupTime !== null ? (
													`${Math.round(cleanupTime)} ms`
												) : (
													<BlankStat />
												)
											}
										/>
									</Flex.Item>
									<Flex.Item size="33.3%">&nbsp;</Flex.Item>
								</Flex>
							</View>
						</Test>

						{/* clear Performance */}
						<Test>
							<Button
								data-testid="clear-button"
								color="primary"
								onClick={clear}
								disabled={!cacheReady}
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
						</Test>
					</form>
				</View>
			</div>
		</>
	);
};

export default App;
