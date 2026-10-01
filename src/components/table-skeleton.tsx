export default function TableSkeleton({ columns, rows = 4 }: { columns: number; rows?: number }) {
  return Array.from({ length: rows }, (_, row) => <tr key={`skeleton-${row}`} className="skeleton-row" aria-hidden="true">
    {Array.from({ length: columns }, (_, column) => <td key={column}>
      <span className="skeleton-block" style={{ width: column === 0 ? "68%" : column === 1 ? "82%" : "60%" }}/>
    </td>)}
  </tr>);
}
