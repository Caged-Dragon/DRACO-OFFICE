import { useEffect, useState } from "react";
import { APP_VERSION } from "../../app/version";
import {
  fetchLatestTag,
  isNewer,
  isValidRepo,
  releaseUrl,
  type LatestTag,
} from "../../services/release/latestTag";
import { useApp } from "../../state/AppContext";
import { useInstallPrompt } from "./useInstallPrompt";

const CACHE_KEY = "draco-slides:latest-tag";
const TTL_MS = 30 * 60 * 1000; // stay well inside GitHub's unauthenticated rate limit

function readCache(repo: string): LatestTag | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { repo: string; at: number; value: LatestTag };
    return c.repo === repo && Date.now() - c.at < TTL_MS ? c.value : null;
  } catch {
    return null;
  }
}

function writeCache(repo: string, value: LatestTag) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ repo, at: Date.now(), value }));
  } catch {
    /* storage unavailable: skip caching */
  }
}

interface Props {
  /** "owner/name" of the GitHub repo that holds the draco-slides/v* tags. */
  repo?: string;
}

export function ReleaseInfo({ repo = import.meta.env.VITE_GITHUB_REPO as string | undefined }: Props) {
  const { notify } = useApp();
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const [latest, setLatest] = useState<LatestTag | null>(null);
  const validRepo = isValidRepo(repo) ? repo : null;

  useEffect(() => {
    if (!validRepo) return;
    const cached = readCache(validRepo);
    if (cached) {
      setLatest(cached);
      return;
    }
    const ctrl = new AbortController();
    fetchLatestTag(validRepo, ctrl.signal)
      .then((t) => {
        if (t) {
          setLatest(t);
          writeCache(validRepo, t);
        }
      })
      .catch(() => {
        /* offline, private repo or rate-limited: fall back to showing this build's version */
      });
    return () => ctrl.abort();
  }, [validRepo]);

  const onInstall = async () => {
    if (canPrompt) {
      await promptInstall();
    } else if (validRepo) {
      window.open(releaseUrl(validRepo, latest?.tag), "_blank", "noopener,noreferrer");
    } else {
      notify("info", "Use your browser's Install option (address bar or menu) to install Draco Slides.");
    }
  };

  const updateAvailable = latest !== null && isNewer(latest.tag, APP_VERSION);

  return (
    <div className="release">
      {latest && validRepo ? (
        <a
          className="release__tag"
          href={releaseUrl(validRepo, latest.tag)}
          target="_blank"
          rel="noopener noreferrer"
          title="Latest release on GitHub"
        >
          Latest {latest.label}
        </a>
      ) : (
        <span className="release__tag" title="Version of this build">
          v{APP_VERSION}
        </span>
      )}
      {updateAvailable && <span className="release__update">Update available</span>}
      {!installed && (
        <button className="btn btn--small btn--primary" onClick={onInstall}>
          Install
        </button>
      )}
    </div>
  );
}
