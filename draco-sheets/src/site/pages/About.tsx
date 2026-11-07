import { A, go } from '../components/Link';
import { PageHead } from '../components/PageHead';

export default function About() {
  return (<><PageHead t="About" d="Draco Sheets is made by Caged Dragon Studios." /><section className="s-sec"><div className="s-wrap s-narrow s-prose">
    <p>Draco Sheets is a spreadsheet for the browser. The goal is simple: the things you reach for in a desktop spreadsheet should be here, without an install.</p>
    <p>Your workbooks are stored in your browser. If you sign in, they can also be saved to the cloud and shared by link. Files you open are processed on your device.</p>
    <p>It is under active development, so some Excel features are still missing; the <A to="/features">features</A> page says which.</p>
    <p><A to="/home" className="s-btn s-btn-go">Open the app</A></p></div></section></>);
}
