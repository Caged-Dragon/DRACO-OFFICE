import { useEffect, useState } from "react";
import { APP_VERSION } from "../../app/version";
import { detectPlatform, fetchInstallerAsset, isDesktopApp } from "../../services/release/installer";
import {
  fetchLatestTag,
  isNewer,
  isValidRepo,
  releaseUrl,
  type LatestTag,
} from "../../services/release/latestTag";
import { useApp } from "../../state/AppContext";
import { startDownload } from "../../utils/download";
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
  userAgent?: string;
}

export function ReleaseInfo({
  repo = import.meta.env.VITE_GITHUB_REPO as string | undefined,
  userAgent = navigator.userAgent,
}: Props) {
  const { notify } = useApp();
  const { canPrompt, installed: pwaInstalled, promptInstall } = useInstallPrompt();
  const [latest, setLatest] = useState<LatestTag | null>(null);
  const [busy, setBusy] = useState(false);
  const validRepo = isValidRepo(repo) ? repo : null;
  const installed = pwaInstalled || isDesktopApp(userAgent);

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

  const updateAvailable = latest !== null && isNewer(latest.tag, APP_VERSION);

  const onInstall = async () => {
    setBusy(true);
    try {
      // 1. Preferred: download the installer attached to the latest tag's GitHub release.
      const platform = detectPlatform(userAgent);
      if (validRepo && latest && platform) {
        try {
          const asset = await fetchInstallerAsset(validRepo, latest.tag, platform);
          if (asset) {
            startDownload(asset.browser_download_url);
            notify("info", `Downloading ${asset.name}. Run it to ${installed ? "update to" : "install"} ${latest.label}.`);
            return;
          }
        } catch {
          /* fall through to the other options */
        }
      }
      // 2. Browser install (PWA), where the browser offers it.
      if (canPrompt && !isDesktopApp(userAgent)) {
        await promptInstall();
        return;
      }
      // 3. Release page.
      if (validRepo) {
        window.open(releaseUrl(validRepo, latest?.tag), "_blank", "noopener,noreferrer");
        notify("info", "No installer for your system is attached to this release yet. Opened the release page instead.");
        return;
      }
      notify("info", "Installer download is not configured for this build.");
    } finally {
      setBusy(false);
    }
  };

  const buttonLabel = installed ? (updateAvailable ? "Update" : null) : "Install";

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
      {updateAvailable && !installed && <span className="release__update">Update available</span>}
      {buttonLabel && (
        <button className="btn btn--small btn--primary" onClick={onInstall} disabled={busy}>
          {buttonLabel}
        </button>
      )}
    </div>
  );
}
