"use client";

import { Printer } from "lucide-react";
import type { AdminLocale } from "@/lib/admin/types";
import styles from "./admin.module.css";

export function PrintButton({ locale }: { locale: AdminLocale }) { return <button className={`${styles.button} ${styles.noPrint}`} type="button" onClick={() => window.print()}><Printer size={17} />{locale === "ar" ? "طباعة" : "Print"}</button>; }
