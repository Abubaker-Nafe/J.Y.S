import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function IndexPage() {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("JYS_LOCALE")?.value;
  redirect(savedLocale === "ar" ? "/ar" : "/en");
}
