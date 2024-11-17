export function WrappedFlexContainer({
	children,
}: { children: React.ReactNode }) {
	return (
		<div
			style={{
				display: "flex",
				flexWrap: "wrap",
				alignItems: "flex-start",
				gap: "1.5rem",
			}}
		>
			{children}
		</div>
	);
}

export function WrappedFlexItem({ children }: { children: React.ReactNode }) {
	return (
		<div
			style={{
				flex: "1 1 calc(50% - 1rem)", // Take 50% of the width minus gap
				minWidth: "300px", // Prevent shrinking too much
				boxSizing: "border-box",
			}}
		>
			{children}
		</div>
	);
}
