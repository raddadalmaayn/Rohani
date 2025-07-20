/* AskScripture.tsx – v2  ✦ expects new ask‑scripture Edge Function */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSearchHistory } from "@/hooks/use-search-history";
import { useUserProgress } from "@/hooks/use-user-progress";
import { useLanguage } from "@/hooks/use-language";
import { SearchWithHistory } from "@/components/SearchWithHistory";
import { SearchLoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Heart, AlertTriangle } from "lucide-react";

/* ---------- API types ---------- */
interface Verse  { id:string; source_ref:string; text_ar:string; text_en?:string }
interface Hadith { id:string; source_ref:string; text_ar:string; text_en?:string }

interface ApiResponse {
  ayat: Verse[];
  ahadith: Hadith[];
  generic_tip: string;
  dua: string;
  is_sensitive: boolean;
}

/* ---------- Component ---------- */
export function AskScripture() {
  const [query, setQuery]   = useState("");
  const [loading, setLoad]  = useState(false);
  const [ayat,    setAyat]  = useState<Verse[]>([]);
  const [ahadith, setAhad]  = useState<Hadith[]>([]);
  const [tip,     setTip]   = useState("");
  const [dua,     setDua]   = useState("");
  const [sensitive, setSensitive] = useState(false);

  const { toast }           = useToast();
  const { saveSearch }      = useSearchHistory();
  const { updateProgress }  = useUserProgress();
  const { t, language }     = useLanguage();     // "ar" | "en"

  /* ---------- search handler ---------- */
  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoad(true); setAyat([]); setAhad([]); setTip(""); setDua(""); setSensitive(false);

    const { data, error } = await supabase.functions.invoke("ask-scripture", {
      body: {
        query: query.trim(),
        lang : language
      }
    });

    setLoad(false);

    if (error) {
      toast({ title:"خطأ", description:error.message, variant:"destructive" });
      return;
    }

    const res = data as ApiResponse;
    setAyat(res.ayat);
    setAhad(res.ahadith);
    setTip(res.generic_tip);
    setDua(res.dua);
    setSensitive(res.is_sensitive);

    await saveSearch(query.trim(), res.ayat.length + res.ahadith.length);
    await updateProgress(1, 0, query.trim());

    toast({
      title: res.ayat.length + res.ahadith.length ? "تم العثور على نتائج" : "لا توجد نتائج",
      description: res.ayat.length + res.ahadith.length
        ? `تم جلب ${res.ayat.length} آية و ${res.ahadith.length} حديثًا`
        : "جرّب صياغة السؤال بطريقة أخرى",
      variant: res.ayat.length + res.ahadith.length ? "default" : "destructive"
    });
  };

  /* ---------- helpers ---------- */
  const isAR = language === "ar";
  const dir  = isAR ? "rtl" : "ltr";
  const textAlign = isAR ? "text-right" : "text-left";

  /* ---------- JSX ---------- */
  return (
    <div className="min-h-screen bg-gradient-calm p-4">
      <div className="max-w-2xl mx-auto">
        {/* header */}
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${isAR ? "font-arabic" : ""}`}>
            {t("ask.title")}
          </h1>
          <p className={`text-muted-foreground ${isAR ? "font-arabic" : ""}`}>
            {t("ask.subtitle")}
          </p>
        </div>

        {/* search bar */}
        <SearchWithHistory
          onSearch={handleSearch}
          currentQuery={query}
          onQueryChange={setQuery}
          isSearching={loading}
        />

        {/* loading */}
        {loading && <SearchLoadingSkeleton />}

        {/* sensitive warning */}
        {sensitive && (
          <Card className="my-6 border-l-4 border-l-amber-500 bg-amber-50/50 shadow-gentle">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className={`text-sm text-amber-800 ${isAR ? "font-arabic" : ""}`}>
                {t("ask.warning")}
              </p>
            </CardContent>
          </Card>
        )}

        {/* results */}
        {!loading && (ayat.length || ahadith.length || tip || dua) && (
          <div className="space-y-6">
            {/* ① Quran verses */}
            {ayat.length > 0 && (
              <Card className="shadow-spiritual border-l-4 border-l-primary">
                <CardHeader><CardTitle>🌿 آيات ذات صلة</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {ayat.map(v => (
                    <div key={v.id}>
                      <p className="font-quran text-xl leading-loose text-right">{v.text_ar}</p>
                      {!isAR && v.text_en && (
                        <p className="italic text-gray-600 mt-1">{v.text_en}</p>
                      )}
                      <Badge>{v.source_ref}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ② Hadiths */}
            {ahadith.length > 0 && (
              <Card className="shadow-spiritual border-l-4 border-l-amber-500">
                <CardHeader><CardTitle>📜 أحاديث نبوية</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {ahadith.map(h => (
                    <div key={h.id}>
                      <p className={`font-arabic leading-relaxed ${textAlign}`}>{h.text_ar}</p>
                      {!isAR && h.text_en && (
                        <p className="italic text-gray-600 mt-1">{h.text_en}</p>
                      )}
                      <Badge>{h.source_ref}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ③ Generic tip */}
            {tip && (
              <Card className="shadow-spiritual border-l-4 border-l-secondary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-secondary" />
                    {t("ask.practical.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`leading-relaxed whitespace-pre-line ${textAlign}`}>
                    {tip}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ④ Dua */}
            {dua && (
              <Card className="shadow-spiritual border-l-4 border-l-emerald-600 bg-gradient-to-r from-emerald-50/40 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-emerald-600" />
                    {t("ask.dua.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`font-quran text-lg leading-relaxed ${textAlign}`}>{dua}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* empty state */}
        {!loading && !ayat.length && !ahadith.length && !tip && !dua && (
          <Card className="shadow-gentle mt-8">
            <CardContent className="p-12 text-center space-y-4">
              <div className="text-6xl">🌱</div>
              <h3 className={`text-xl font-semibold ${isAR ? "font-arabic" : ""}`}>
                {t("ask.empty.title")}
              </h3>
              <p className={`text-muted-foreground ${isAR ? "font-arabic" : ""}`}>
                {t("ask.empty.description")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
