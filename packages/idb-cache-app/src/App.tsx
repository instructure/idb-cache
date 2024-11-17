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
import { CacheKey } from "./components/CacheKey";
import { CacheBuster } from "./components/CacheBuster";
import {
	WrappedFlexContainer,
	WrappedFlexItem,
} from "./components/WrappedFlexItem";
import { Test } from "./components/Test";

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
const DEFAULT_CHUNK_SIZE = 25000;
const DEAFULT_MAX_CHUNKS_STORED = 5000;

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
	const [clearTime, setClearTime] = useState<number | null>(null);

	const [itemSize, setItemSize] = useState<number>(getInitialItemSize());
	const [chunkSize, setChunkSize] = useState<number>(DEFAULT_CHUNK_SIZE);
	const [itemCount, setItemCount] = useState<number | null>(null);
	const [maxTotalChunksStored, setMaxTotalChunksStored] = useState<number>(
		DEAFULT_MAX_CHUNKS_STORED,
	);

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

	const encryptAndStore = useCallback(async () => {
		const key = deterministicHash(`seed-${keyCounter.current}`);
		localStorage.setItem("keyCounter", String(keyCounter.current));
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
		setSetItemTime(end2 - start2);

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
		setGetItemTime(end - start);
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
		localStorage.removeItem("keyCounter");
		const end = performance.now();
		setClearTime(end - start);
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
								<CacheKey cacheKey={cacheKey} />
							</WrappedFlexItem>
							<WrappedFlexItem>
								<CacheBuster cacheBuster={cacheBuster} />
							</WrappedFlexItem>

							<WrappedFlexItem>
								<NumberInput
									renderLabel="Size of item (KB):"
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
							</WrappedFlexItem>
							<WrappedFlexItem>
								<NumberInput
									renderLabel="Chunks per item:"
									interaction="disabled"
									value={Math.ceil(itemSize / 25000)}
								/>
							</WrappedFlexItem>

							<WrappedFlexItem>
								<NumberInput
									disabled
									renderLabel="Chunk size (KB):"
									onChange={(e) => {
										const newValue = Math.max(
											Number.parseInt(e.target.value, 10) * 1024,
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
									value={Math.round(chunkSize / 1024)} // Display in KB
								/>
							</WrappedFlexItem>

							<WrappedFlexItem>
								<NumberInput
									renderLabel="Max total chunks:"
									onChange={(e) => {
										const newValue = Number.parseInt(e.target.value, 10) || 1;
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
						</WrappedFlexContainer>

						<Heading level="h2" margin="medium 0 small 0">
							Tests
						</Heading>

						{/* setItem Performance */}
						<View
							as="div"
							display="block"
							margin="small none"
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
							</Flex>
						</View>

						{/* getItem Performance */}
						<Test>
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

						{/* clear Performance */}
						<Test>
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
						</Test>
					</form>
				</View>
			</div>
		</>
	);
};

export default App;
