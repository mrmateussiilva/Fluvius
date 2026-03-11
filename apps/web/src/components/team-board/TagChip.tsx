type TagChipProps = {
  label: string
}

export function TagChip({ label }: TagChipProps) {
  return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{label}</span>
}
