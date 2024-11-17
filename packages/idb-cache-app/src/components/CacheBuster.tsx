import { Button } from "@instructure/ui-buttons";
import { Flex } from "@instructure/ui-flex";
import { TextInput } from "@instructure/ui-text-input";

export function CacheBuster({ cacheBuster }: { cacheBuster: string }) {
	return (
		<Flex alignItems="end">
			<Flex.Item shouldGrow>
				<TextInput
					renderLabel="Cache buster:"
					interaction="disabled"
					defaultValue={cacheBuster}
				/>
			</Flex.Item>
			<Flex.Item>
				<Button
					aria-label="Reset cache buster"
					margin="0 0 0 xxx-small"
					data-testid="reset-cacheBuster"
					onClick={() => {
						localStorage.removeItem("cacheBuster");
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
