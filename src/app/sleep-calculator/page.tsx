import { SleepCalculator } from "@/components/sleep-calculator";
import { SleepPatternApp } from "@/components/sleep-pattern-app";

export default function SleepCalculatorPage() {
  return <SleepPatternApp activePage="calculator"><SleepCalculator /></SleepPatternApp>;
}