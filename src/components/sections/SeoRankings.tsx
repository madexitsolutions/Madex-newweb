import { Icon } from "@/components/ui/Icon";
import { Reveal, SplitText, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { rankings, rankingsDate, type Ranking } from "@/content/seo-rankings";
import "./seo-rankings.css";

const ROWS = 4;

/** One search, redrawn: the query, the result list with the client at its real place, and what else Google shows. */
function SearchCard({ r }: { r: Ranking }) {
  return (
    <article className="sr-card">
      <div className="sr-query">
        <Icon name="seo" size={18} />
        <span>{r.query}</span>
      </div>
      <ol className="sr-list" aria-label={`Suchergebnisse für «${r.query}»`}>
        {Array.from({ length: ROWS }, (_, i) => i + 1).map((n) =>
          n === r.position ? (
            <li key={n} className="sr-hit" aria-current="true">
              <span className="sr-n">{n}</span>
              <div className="sr-hit-body">
                <p className="sr-site">
                  <span className="sr-fav" aria-hidden="true">
                    {r.client[0].toUpperCase()}
                  </span>
                  <span>
                    <b>{r.client}</b>
                    <small>{r.breadcrumb}</small>
                  </span>
                </p>
                <p className="sr-title">{r.title}</p>
                <p className="sr-snippet">{r.snippet}</p>
              </div>
            </li>
          ) : (
            <li key={n} className="sr-other" aria-hidden="true">
              <span className="sr-n">{n}</span>
              <span className="sr-ghost">
                <i style={{ width: `${46 + ((n * 17 + r.query.length) % 30)}%` }} />
                <i style={{ width: `${70 + ((n * 11 + r.query.length) % 22)}%` }} />
              </span>
            </li>
          ),
        )}
      </ol>
      <footer className="sr-foot">
        <p className="sr-rank">
          <strong>Platz {r.position}</strong> bei Google
        </p>
        {(r.maps || r.aiOverview || r.also) && (
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
                <Icon name="seo" size={15} /> «{r.also.query}»: Platz {r.also.position}
              </li>
            )}
          </ul>
        )}
      </footer>
    </article>
  );
}

/** SEO page: where the websites of Madex clients stand on Google for real searches. */
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
              Echte Suchanfragen aus der Ostschweiz – und wo die Websites unserer Kunden bei Google stehen. Ohne bezahlte Anzeigen, allein durch Inhalt, Technik und lokale Sichtbarkeit.
            </p>
          </Reveal>
        </div>
        <StaggerGroup className="sr-grid" gap={0.1}>
          {rankings.map((r) => (
            <StaggerItem key={r.query}>
              <SearchCard r={r} />
            </StaggerItem>
          ))}
        </StaggerGroup>
        <p className="sr-note">
          Google-Suche im {rankingsDate}, Standort Ostschweiz. Die Reihenfolge hängt von Ort, Gerät und Suchverlauf ab und kann sich ändern.
        </p>
      </div>
    </section>
  );
}
