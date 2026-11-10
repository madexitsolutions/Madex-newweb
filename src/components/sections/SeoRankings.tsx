import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { Reveal, SplitText } from "@/components/ui/motion";
import { rankings, rankingsDate, type Ranking } from "@/content/seo-rankings";
import "./seo-rankings.css";

const src = (slug: string, full = false) => `/media/seo-ergebnisse/${slug}${full ? "-ganz" : ""}.webp`;

/** One real search: the unedited screenshot, the client's entries framed, the full screenshot one click away. */
function SearchCard({ r }: { r: Ranking }) {
  return (
    <article className="sr-card">
      <header className="sr-top">
        <p className="sr-query">
          <Icon name="seo" size={17} />
          <span>{r.query}</span>
        </p>
        <p className="sr-rank">
          <strong>Platz {r.position}</strong>
        </p>
      </header>
      <a className="sr-shot" href={src(r.slug, true)} target="_blank" rel="noopener" aria-label={`Ganzen Screenshot der Google-Suche «${r.query}» öffnen`}>
        <Image src={src(r.slug)} alt={`Google-Suche «${r.query}»: ${r.client} auf Platz ${r.position}`} width={r.w} height={r.h} sizes="(max-width: 900px) 92vw, 560px" />
        {r.marks.map(([x, y, w, h], i) => (
          <span key={i} className="sr-mark" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }} aria-hidden="true" />
        ))}
      </a>
      <footer className="sr-foot">
        <p className="sr-client">{r.client}</p>
        <ul className="sr-extra">
          {r.aiOverview && (
            <li>
              <Icon name="spark" size={15} /> In der KI-Übersicht genannt
            </li>
          )}
          {r.maps && (
            <li>
              <Icon name="pin" size={15} /> {r.maps}
            </li>
          )}
          {r.also && (
            <li>
              <a href={src(r.also.slug, true)} target="_blank" rel="noopener">
                «{r.also.query}»: Platz {r.also.position}
              </a>
            </li>
          )}
          <li>
            <a href={src(r.slug, true)} target="_blank" rel="noopener">
              Ganzer Screenshot
            </a>
          </li>
        </ul>
      </footer>
    </article>
  );
}

/** SEO page: real Google searches and where the websites of Madex clients stand. */
export function SeoRankings() {
  return (
    <section className="section white sr" aria-label="Ergebnisse unserer Kunden bei Google">
      <div className="container">
        <div className="sr-head">
          <div>
            <p className="eyebrow">Ergebnisse unserer Kunden</p>
            <SplitText as="h2" text="Gefunden, wenn Ihre Kunden suchen." className="h2" />
          </div>
          <Reveal className="sr-intro">
            <p className="lead muted">
              Echte Google-Suchen aus der Ostschweiz, unbearbeitet. Markiert sind die Websites unserer Kunden – ohne bezahlte Anzeigen, allein durch Inhalt, Technik und lokale Sichtbarkeit.
            </p>
          </Reveal>
        </div>
        <div className="sr-grid">
          {rankings.map((r) => (
            <Reveal key={r.slug} className="sr-item" y={30}>
              <SearchCard r={r} />
            </Reveal>
          ))}
        </div>
        <p className="sr-note">
          Screenshots der Google-Suche vom {rankingsDate}, Standort Ostschweiz. Die Reihenfolge hängt von Ort, Gerät und Suchverlauf ab und kann sich ändern.
        </p>
      </div>
    </section>
  );
}
