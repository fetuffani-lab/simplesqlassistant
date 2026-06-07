import AppDockLayout from "./components/layout/DockLayout";
import ExecutionStatus from "./components/status/ExecutionStatus";

export default function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <AppDockLayout />
      </div>
      <ExecutionStatus />
    </div>
  );
}
