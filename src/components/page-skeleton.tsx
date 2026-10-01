import TableSkeleton from "@/components/table-skeleton";

export default function PageSkeleton({ title, columns, sections = 1 }: { title: string; columns: number; sections?: number }) {
  return <main aria-busy="true">
    <header className="topbar"><nav className="crumbs"><a className="ghost" href="/">Signal</a></nav></header>
    <div className="content">
      <h1>{title}</h1>
      <p className="lede"><span className="skeleton-block skeleton-lede" aria-hidden="true"/></p>
      {Array.from({ length: sections }, (_, section) => <div key={section}>
        {sections > 1 && <h2><span className="skeleton-block skeleton-heading" aria-hidden="true"/></h2>}
        <div className="table-scroll"><table className="db" aria-label={`Loading ${title.toLowerCase()}`}>
          <thead><tr>{Array.from({ length: columns }, (_, column) => <th key={column}><span className="skeleton-block skeleton-header" aria-hidden="true"/></th>)}</tr></thead>
          <tbody><TableSkeleton columns={columns}/></tbody>
        </table></div>
      </div>)}
    </div>
  </main>;
}
