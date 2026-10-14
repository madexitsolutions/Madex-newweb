import { BackdropCanvas } from "@/components/three/Scenes";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="nf dark">
      <BackdropCanvas className="nf__canvas" scene="lost" />
      <div className="container nf__inner">
        <p className="eyebrow">Fehler 404</p>
        <h1 className="display">
          Diese Seite ist
          <br />
          <span className="text-gradient">abgehoben.</span>
        </h1>
        <p className="lead muted">Die gesuchte Seite existiert nicht (mehr). Vielleicht finden Sie hier, was Sie suchen:</p>
        <div className="nf__ctas">
          <Button href="/">Zur Startseite</Button>
          <Button href="/marketing-solutions" variant="ghost">
            Marketing Lösungen
          </Button>
          <Button href="/kontakt" variant="ghost">
            Kontakt
          </Button>
        </div>
      </div>
      <style>{`
        .nf{position:relative;min-height:100vh;display:flex;align-items:center;overflow:hidden;isolation:isolate}
        .nf__canvas{position:absolute!important;inset:0;z-index:-1}
        .nf__inner{padding-block:140px}
        .nf__ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
      `}</style>
    </section>
  );
}
