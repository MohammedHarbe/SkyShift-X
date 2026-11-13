/** Scientific metadata and provenance of one observation, exactly as supplied by the data service. */
import type { Observation } from '@/contracts/v1';
import { resolveAssetUrl } from '@/api';
import { formatDec, formatDeg, formatRa, formatUtc } from '@/lib/astro';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui';
import { ClassificationBadge, DataList, ExternalLink, type DataItem } from '@/ui';

export interface ObservationMetadataProps {
  observation: Observation;
  className?: string;
}

const arcmin = (deg: number) => `${(deg * 60).toFixed(1)}′`;

function Group({ title, items }: { title: string; items: DataItem[] }) {
  return (
    <div>
      <h4 className="eyebrow mb-1.5">{title}</h4>
      <DataList items={items} />
    </div>
  );
}

export function ObservationMetadata({ observation: o, className }: ObservationMetadataProps) {
  const research = useUiStore((s) => s.audience) === 'research';
  const p = o.provenance;

  const when: DataItem[] = [
    { label: 'Observed', value: <time dateTime={o.observedAt}>{formatUtc(o.observedAt)}</time>, mono: true },
    ...(research ? [{ label: 'MJD', value: o.mjd.toFixed(5), mono: true }] : []),
  ];
  const where: DataItem[] = [
    { label: 'Centre RA', value: <>{formatRa(o.center.raDeg)}{research && <span className="text-dim"> ({formatDeg(o.center.raDeg, 5)})</span>}</>, mono: true },
    { label: 'Centre Dec', value: <>{formatDec(o.center.decDeg)}{research && <span className="text-dim"> ({formatDeg(o.center.decDeg, 5)})</span>}</>, mono: true },
    { label: 'Field size', value: `${arcmin(o.sizeDeg.width)} × ${arcmin(o.sizeDeg.height)}`, mono: true },
    ...(research ? [{ label: 'Pixel scale', value: `${o.pixelScaleArcsec}″ per pixel`, mono: true }, { label: 'Frame', value: o.center.frame, mono: true }] : []),
  ];
  const light: DataItem[] = [
    { label: 'Wavelength', value: `${o.centralWavelengthUm.toFixed(3)} µm`, mono: true },
    ...(research ? [{ label: 'Bandwidth', value: `${o.bandwidthUm.toFixed(4)} µm`, mono: true }] : []),
    { label: 'Detector band', value: o.bandId, mono: true },
  ];

  return (
    <div className={cn('space-y-4 text-[13px]', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ice">{o.epochLabel}</span>
        <ClassificationBadge classification={p.classification} />
      </div>

      {!research && (
        <p className="leading-relaxed text-mist">
          One image of this patch of sky, taken at a single infrared wavelength. Infrared light is invisible to our eyes; brighter pixels mean more of it arrived from that direction.
        </p>
      )}

      <Group title="When" items={when} />
      <Group title="Where" items={where} />
      <Group title="Light" items={light} />

      {research && (
        <>
          <Group
            title="Data product"
            items={[
              { label: 'Level', value: o.product.level },
              { label: 'Collection', value: o.product.collection, mono: true },
              { label: 'Processing version', value: o.product.processingVersion, mono: true },
              { label: 'File', value: o.product.fileName ?? '—', mono: true },
              { label: 'Extensions', value: o.product.extensions.join(', '), mono: true },
            ]}
          />
          <Group
            title="Quality"
            items={[
              { label: 'Flagged pixels', value: `${(o.quality.flaggedPixelFraction * 100).toFixed(2)}%`, mono: true },
              { label: 'Flags present', value: o.quality.flagsPresent.length ? o.quality.flagsPresent.join(', ') : 'none', mono: true },
            ]}
          />
          {o.quality.notes && <p className="-mt-2 text-xs text-dim">{o.quality.notes}</p>}
          <Group
            title="Preview display"
            items={[
              { label: 'Stretch', value: o.display.stretch, mono: true },
              { label: 'Range', value: `${o.display.vmin} to ${o.display.vmax} ${o.display.unit}`, mono: true },
              { label: 'Image size', value: `${o.image.width} × ${o.image.height} px`, mono: true },
            ]}
          />
        </>
      )}

      <div>
        <h4 className="eyebrow mb-1.5">Provenance</h4>
        <p className="leading-relaxed text-mist">{p.origin}</p>
        {p.notes && <p className="mt-1 leading-relaxed text-mist">{p.notes}</p>}
        {research && (
          <DataList
            className="mt-2"
            items={[
              { label: 'Pipeline', value: p.pipeline ?? '—', mono: true },
              { label: 'Version', value: p.processingVersion ?? '—', mono: true },
              { label: 'Observation ID', value: o.id, mono: true },
            ]}
          />
        )}
      </div>

      <div>
        <h4 className="eyebrow mb-1.5">Downloads</h4>
        {o.downloads.length > 0 ? (
          <ul className="space-y-1">
            {o.downloads.map((d) => (
              <li key={d.url}>
                <ExternalLink href={resolveAssetUrl(d.url)}>{d.label}</ExternalLink>
                <span className="num ml-2 text-xs text-dim">
                  {d.format.toUpperCase()}
                  {d.sizeBytes !== undefined && ` · ${(d.sizeBytes / 1e6).toFixed(1)} MB`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-dim">No downloads supplied by the data service.</p>
        )}
      </div>
    </div>
  );
}
