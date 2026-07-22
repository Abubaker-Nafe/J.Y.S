import { adminStyles as styles } from "@/components/admin/AdminUi";
import { LocalizedLoadingLabel } from "@/components/storefront/loading-label";

export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <div className={styles.pageHeader}><div><div style={{ width: "14rem", height: "2.2rem", background: "#e1e7e3", borderRadius: ".5rem" }} /><div style={{ width: "24rem", maxWidth: "70vw", height: ".9rem", marginTop: ".7rem", background: "#e1e7e3", borderRadius: ".4rem" }} /></div></div>
      <div className={`${styles.grid} ${styles.metrics}`}>{Array.from({ length: 8 }, (_, index) => <div className={styles.card} style={{ minHeight: "7rem", background: index % 2 ? "#fff" : "#f9fbfa" }} key={index} />)}</div>
      <LocalizedLoadingLabel admin />
    </div>
  );
}
