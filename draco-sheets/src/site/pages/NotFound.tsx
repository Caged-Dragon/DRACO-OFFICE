import { A } from '../components/Link';
import { PageHead } from '../components/PageHead';

export default function NotFound() {
  return (
    <>
      <PageHead t="Page not found" d="That page does not exist." />
      <section className="s-sec">
        <div className="s-wrap">
          <A to="/" className="s-btn s-btn-go">
            Go home
          </A>
        </div>
      </section>
    </>
  );
}
