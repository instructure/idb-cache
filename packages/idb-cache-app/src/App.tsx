import "./App.css";
import { IDBCache } from "@instructure/idb-cache";
import { useCallback, useState } from "react";
import { uuid, deterministicHash, generateTextOfSize } from "./utils";
import { Button } from "@instructure/ui-buttons";
import { Metric } from "@instructure/ui-metric";
import { View } from "@instructure/ui-view";
import { Flex } from "@instructure/ui-flex";
import { Heading } from "@instructure/ui-heading";
import { NumberInput } from "@instructure/ui-number-input";

// For demonstration/testing purposes.
//   Do *not* store cacheKey to localStorage in production.
let cacheKey: string = localStorage.cacheKey;
if (!cacheKey) {
	cacheKey = uuid();
	localStorage.cacheKey = cacheKey;
}

let cacheBuster: string = localStorage.cacheBuster;
if (!cacheBuster) {
	cacheBuster = uuid();
	localStorage.cacheBuster = cacheBuster;
}

const cache = new IDBCache({
	cacheKey,
	cacheBuster,
	debug: true,
});

const DEFAULT_NUM_ITEMS = 1;

const DEFAULT_ITEM_SIZE = 10240;

const initialItemSize =
	Number.parseInt(
		localStorage.getItem("itemSize") || String(DEFAULT_ITEM_SIZE),
	) || DEFAULT_ITEM_SIZE;

const BlankStat = () => (
	<span
		style={{
			color: "#ddd",
		}}
	>
		------
	</span>
);

const App = () => {
	const [hash1, setHash1] = useState<string | null>(null);
	const [hash2, setHash2] = useState<string | null>(null);
	const [timeToGenerate, setTimeToGenerate] = useState<number | null>(null);
	const [setTime, setSetTime] = useState<number | null>(null);
	const [getTime, setGetTime] = useState<number | null>(null);
	const [itemSize, setItemSize] = useState<number>(initialItemSize);

	const encryptAndStore = useCallback(async () => {
		const start1 = performance.now();
		const paragraphs = Array.from({ length: DEFAULT_NUM_ITEMS }, (_, index) =>
			generateTextOfSize(itemSize, `${cacheBuster}-${index}`),
		);
		const end1 = performance.now();
		setTimeToGenerate(end1 - start1);

		const start2 = performance.now();

		for (let i = 0; i < DEFAULT_NUM_ITEMS; i++) {
			await cache.setItem(`item-${i}`, paragraphs[i]);
		}

		const end2 = performance.now();
		setSetTime(end2 - start2);

		setHash1(deterministicHash(paragraphs.join("")));
	}, [itemSize]);

	const retrieveAndDecrypt = useCallback(async () => {
		const results: Array<string | null> = [];
		const start = performance.now();

		for (let i = 0; i < DEFAULT_NUM_ITEMS; i++) {
			const result = await cache.getItem(`item-${i}`);
			results.push(result);
		}

		const end = performance.now();
		setGetTime(end - start);
		setHash2(results.length > 0 ? deterministicHash(results.join("")) : null);
	}, []);

	return (
		<>
			<a
				href="https://github.com/instructure/idb-cache"
				aria-label="View source on GitHub"
			>
				<svg
					width={80}
					height={80}
					viewBox="0 0 250 250"
					style={{
						fill: "#151513",
						color: "#fff",
						position: "absolute",
						top: 0,
						border: 0,
						right: 0,
					}}
					aria-hidden="true"
				>
					<path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" />
					<path
						d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2"
						fill="currentColor"
						style={{ transformOrigin: "130px 106px" }}
						className="octo-arm"
					/>
					<path
						d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z"
						fill="currentColor"
						className="octo-body"
					/>
				</svg>
				<span style={{ position: "absolute", left: "-9999px" }}>
					View source on GitHub
				</span>
			</a>

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
											renderLabel="Size of data (kb):"
											onChange={(e) => {
												const newValue = Math.max(
													Number.parseInt(e.target.value) * 1024,
													1024,
												);
												setItemSize(newValue);
												localStorage.setItem("itemSize", String(newValue));
											}}
											onIncrement={() => {
												const newValue = Math.max(
													Math.round(itemSize) + 1 * 1024,
													1024,
												);
												setItemSize(newValue);
												localStorage.setItem("itemSize", String(newValue));
											}}
											onDecrement={() => {
												const newValue = Math.max(
													Math.round(itemSize) - 1 * 1024,
													1024,
												);
												setItemSize(newValue);
												localStorage.setItem("itemSize", String(newValue));
											}}
											isRequired
											value={Math.round(itemSize / 1024)}
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
								<View
									as="span"
									display="inline-block"
									margin="none"
									padding="medium"
									background="primary"
									shadow="resting"
								>
									<Flex direction="column">
										<Button color="primary" onClick={encryptAndStore}>
											setItem
										</Button>
										<View padding="medium 0 0 0">
											<Flex>
												<Flex.Item size="33.3%">
													<Metric
														renderLabel="generate test data"
														renderValue={
															setTime !== null ? (
																`${Math.round(timeToGenerate || 0)} ms`
															) : (
																<BlankStat />
															)
														}
													/>
												</Flex.Item>
												<Flex.Item shouldGrow>
													<Metric
														renderLabel="setItem"
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
														renderLabel="hash"
														renderValue={hash1 || <BlankStat />}
													/>
												</Flex.Item>
											</Flex>
										</View>
									</Flex>
								</View>

								<View
									as="span"
									display="inline-block"
									margin="none"
									padding="medium"
									background="primary"
									shadow="resting"
								>
									<Flex direction="column">
										<Button color="primary" onClick={retrieveAndDecrypt}>
											getItem
										</Button>

										<View padding="medium 0 0 0">
											<Flex>
												<Flex.Item size="33.3%">&nbsp;</Flex.Item>
												<Flex.Item shouldGrow>
													<Metric
														renderLabel="getItem"
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
														renderValue={hash2 || <BlankStat />}
													/>
												</Flex.Item>
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
