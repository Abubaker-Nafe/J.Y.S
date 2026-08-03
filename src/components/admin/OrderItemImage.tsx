"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./admin.module.css";

export function OrderItemImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed
    ? <Image className={styles.orderThumb} src={src} alt={alt} width={56} height={56} unoptimized onError={() => setFailed(true)} />
    : <span className={`${styles.orderThumb} ${styles.placeholderThumb}`} role="img" aria-label={alt}>JYS</span>;
}
