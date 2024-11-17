import { Button } from "@instructure/ui-buttons";
import { Flex } from "@instructure/ui-flex";
import { TextInput } from "@instructure/ui-text-input";

export function CacheKey({
	cacheKey,
}: {
	cacheKey: string;
}) {
	return (
		<Flex alignItems="end">
			<Flex.Item shouldGrow>
				<TextInput
					renderLabel="Cache key:"
					interaction="disabled"
					defaultValue={cacheKey}
				/>
			</Flex.Item>
			<Flex.Item>
				<Button
					aria-label="Reset cache key"
					margin="0 0 0 xxx-small"
					data-testid="reset-cacheKey"
					onClick={() => {
						localStorage.removeItem("cacheKey");
						localStorage.removeItem("keyCounter");
						window.location.reload();
					}}
				>
					Reset
				</Button>
			</Flex.Item>
		</Flex>
	);
}
