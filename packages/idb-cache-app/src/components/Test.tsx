import { Flex } from "@instructure/ui-flex";
import { View } from "@instructure/ui-view";

export function Test({ children }: { children: React.ReactNode }) {
	return (
		<View
			as="div"
			display="block"
			margin="small none"
			padding="medium"
			background="primary"
			shadow="resting"
		>
			<Flex direction="column">{children}</Flex>
		</View>
	);
}
