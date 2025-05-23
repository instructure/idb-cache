import { Button } from "@instructure/ui-buttons";
import { Flex } from "@instructure/ui-flex";
import { IconInfoLine } from "@instructure/ui-icons";
import { TextInput } from "@instructure/ui-text-input";
import { Tooltip } from "@instructure/ui-tooltip";
import { View } from "@instructure/ui-view";

export function CacheKey({
	cacheKey,
}: {
	cacheKey: string;
}) {
	return (
		<Flex alignItems="end">
			<Flex.Item shouldGrow>
				<TextInput
					renderLabel={
						<Flex alignItems="end">
							<Flex.Item as="div">
								<View margin="0 xx-small 0 0">Cache key</View>
							</Flex.Item>
							<Tooltip
								color="primary-inverse"
								renderTip="Sensitive identifier used for securely encrypting data."
								offsetY="5px"
							>
								<Flex.Item as="div">
									<IconInfoLine />
								</Flex.Item>
							</Tooltip>
						</Flex>
					}
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
