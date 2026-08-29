import certificationIndex from "./solution-play-certification.json";
import type { SolutionPlay, SolutionPlayCertification, SolutionPlayCertificationLevel } from "../types";

const certificationBySlug = new Map(
  (certificationIndex.plays as SolutionPlayCertification[]).map((record) => [record.slug, record]),
);

const labels: Record<SolutionPlayCertificationLevel, string> = {
  designed: "Designed",
  scaffold_verified: "Scaffold Verified",
  build_verified: "Build Verified",
  evaluation_verified: "Evaluation Verified",
  deploy_verified: "Deploy Verified",
  production_observed: "Production Observed",
};

export function certificationForPlay(play: Pick<SolutionPlay, "dir" | "slug">): SolutionPlayCertification | undefined {
  const certification = certificationBySlug.get(play.slug || play.dir);
  if (!certification) return undefined;
  if (!Number.isFinite(Date.parse(certification.expires_at)) || Date.parse(certification.expires_at) <= Date.now()) {
    return { ...certification, valid: false, level: null, reasons: [...certification.reasons, "certification evidence expired"] };
  }
  return certification;
}

export function certificationLabel(certification?: SolutionPlayCertification): string {
  if (!certification?.valid || !certification.level) return "Uncertified";
  return labels[certification.level];
}

export function withCertification(play: SolutionPlay): SolutionPlay {
  const certification = certificationForPlay(play);
  return { ...play, certification, status: certificationLabel(certification) };
}
