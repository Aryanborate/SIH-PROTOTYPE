'use client'

// Printable Digital Skill Passport — mirrors the in-app passport document (skill-passport.tsx)
// using the same standalone-print + download-fallback pattern as the payment receipt.

import type { WorkerDTO } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { Printer, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const s = d.slice(0, 10).split('-')
  if (s.length < 3) return esc(d)
  return `${Number(s[2])} ${MONTHS[Number(s[1]) - 1] ?? '?'} ${s[0]}`
}

function stars(rating: number): string {
  const full = Math.floor(rating)
  return '★'.repeat(Math.max(0, Math.min(5, full))) + '☆'.repeat(Math.max(0, 5 - full))
}

// Deterministic decorative QR grid (same seed pattern as the on-screen passport)
const QR_ROWS = ['1101101', '1001001', '1010110', '0110101', '1011010', '1001101', '1101011']

/** Standalone, print-friendly HTML for the passport card (also used for the download fallback). */
export function passportHtml(w: WorkerDTO, cooperative: { name: string; regNo: string }): string {
  const initials = w.name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()
  const skills = w.skills.map((s) => `<li>${esc(s)}</li>`).join('')
  const secondary = w.secondarySkills.length
    ? `<div class="row"><span class="lab">Secondary skills</span><span class="val">${esc(w.secondarySkills.join(', '))}</span></div>`
    : ''
  const bio = w.bioEn ? `<div class="bio">“${esc(w.bioEn)}”</div>` : ''
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Skill Passport — ${esc(w.name)} — GigSetu</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #fafaf9; color: #18181b; padding: 24px; }
  .sheet { max-width: 480px; margin: 0 auto; background: #fff; border: 2px solid rgba(120,53,15,0.3); border-radius: 12px; overflow: hidden; position: relative; }
  .head { position: relative; background: linear-gradient(135deg, #fffbeb, #fff7ed, #fef3c7); padding: 20px 22px 16px; }
  .head::before { content: ''; position: absolute; inset: 0; opacity: 0.7; background:
    repeating-linear-gradient(45deg, transparent 0 7px, rgba(180,83,9,0.06) 7px 8px),
    repeating-linear-gradient(-45deg, transparent 0 11px, rgba(180,83,9,0.05) 11px 12px); }
  .head > * { position: relative; }
  .doc-title { font-size: 14px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: #78350f; }
  .doc-sub { font-size: 9px; letter-spacing: 2.4px; text-transform: uppercase; color: rgba(120,53,15,0.65); margin-top: 3px; }
  .seal { position: absolute; top: 14px; right: 16px; width: 64px; height: 64px; border: 2px solid rgba(146,64,14,0.45); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; transform: rotate(6deg); color: rgba(146,64,14,0.75); font-family: Arial, sans-serif; font-size: 7px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; background: rgba(255,255,255,0.55); }
  .identity { display: flex; align-items: center; gap: 14px; margin-top: 14px; }
  .avatar { width: 56px; height: 56px; border: 2px solid rgba(120,53,15,0.25); border-radius: 8px; background: #fef3c7; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: #b45309; }
  .who h2 { font-size: 22px; letter-spacing: -0.3px; }
  .who .wid { display: inline-block; margin-top: 3px; background: #f4f4f5; padding: 1px 6px; border-radius: 3px; font-family: monospace; font-size: 10px; color: #52525b; }
  .who .coop { margin-top: 4px; font-size: 11px; color: #52525b; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px 16px; border-top: 1.5px dashed rgba(120,53,15,0.25); margin: 14px 22px 0; padding-top: 14px; }
  .f .lab { font-size: 8.5px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: rgba(120,53,15,0.6); font-family: Arial, sans-serif; }
  .f .v { margin-top: 3px; font-size: 12.5px; font-weight: 500; }
  .f .v.small { font-size: 10.5px; }
  .f .v.cap { text-transform: capitalize; }
  .prow { margin: 12px 22px 0; border-top: 1.5px dashed rgba(120,53,15,0.25); padding-top: 10px; }
  .prow .lab { font-size: 8.5px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: rgba(120,53,15,0.6); font-family: Arial, sans-serif; }
  .prow .v { margin-top: 3px; font-size: 11.5px; font-weight: 500; text-transform: capitalize; }
  .ok { color: #059669; font-weight: 700; }
  .skills { margin: 12px 22px 0; border-top: 1.5px dashed rgba(120,53,15,0.25); padding-top: 12px; }
  .skills ul { margin-top: 5px; list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 3px 12px; font-size: 11px; }
  .skills li::before { content: '✓ '; color: #059669; font-weight: 700; }
  .bio { margin: 12px 22px 0; background: #fafaf9; border-radius: 8px; padding: 9px 12px; font-size: 11px; font-style: italic; color: #52525b; line-height: 1.55; }
  .foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; border-top: 1.5px solid rgba(120,53,15,0.25); margin: 16px 22px 0; padding: 10px 0 16px; }
  .foot .issuer { font-size: 9.5px; color: rgba(120,53,15,0.7); line-height: 1.6; font-family: Arial, sans-serif; }
  .foot .issuer b { letter-spacing: 1.6px; text-transform: uppercase; font-size: 8.5px; }
  .qr { display: grid; grid-template-columns: repeat(7, 6px); grid-auto-rows: 6px; gap: 1px; padding: 3px; border: 1px solid #d4d4d8; border-radius: 4px; }
  .qr span { background: transparent; }
  .qr span.on { background: rgba(24,24,27,0.78); }
  .qr-label { font-size: 7px; letter-spacing: 1.2px; text-transform: uppercase; color: #71717a; text-align: center; margin-top: 3px; font-family: Arial, sans-serif; }
  .note { text-align: center; font-size: 9px; color: #71717a; line-height: 1.6; padding: 0 22px 16px; font-family: Arial, sans-serif; }
  .foil { height: 7px; background: linear-gradient(90deg, #f59e0b, #fbbf24, #fef3c7, #fbbf24, #f59e0b); }
  @media print { body { background: #fff; padding: 0; } .sheet { border-radius: 0; border: 1.5px solid rgba(120,53,15,0.3); } }
</style></head>
<body><div class="sheet">
  <div class="head">
    <div class="seal"><span>Verified</span><span>Member</span></div>
    <p class="doc-title">Digital Skill Passport</p>
    <p class="doc-sub">GigSetu Cooperative Network · कौशल पासपोर्ट</p>
    <div class="identity">
      <div class="avatar">${esc(initials)}</div>
      <div class="who">
        <h2>${esc(w.name)}</h2>
        <span class="wid">ID · ${esc(w.id)}</span>
        <p class="coop">${esc(cooperative.name)} · Reg. ${esc(cooperative.regNo)}</p>
      </div>
    </div>
  </div>
  <div class="grid">
    <div class="f"><div class="lab">Primary skill</div><div class="v cap">${esc(w.primarySkill)}</div></div>
    <div class="f"><div class="lab">Experience</div><div class="v">${esc(w.experienceYears)} years</div></div>
    <div class="f"><div class="lab">Rating</div><div class="v ok">${stars(w.rating)} <span style="font-family:Arial,sans-serif;font-size:10px">${w.rating.toFixed(2)}</span></div></div>
    <div class="f"><div class="lab">Certification</div><div class="v small">${esc(w.certName)}<br/><span class="ok">${esc(w.certStatus)}</span> · valid till ${fmtDate(w.certExpiry)}</div></div>
    <div class="f"><div class="lab">Safety training</div><div class="v ${w.safetyValid ? 'ok' : ''}">${w.safetyValid ? '✓ Valid' : 'Lapsed — renew at coop'}</div></div>
    <div class="f"><div class="lab">Completed jobs</div><div class="v">${Number(w.completedJobs).toLocaleString('en-IN')}</div></div>
    <div class="f"><div class="lab">Languages</div><div class="v small">${esc(w.languages.join(', '))}</div></div>
    <div class="f"><div class="lab">Service areas</div><div class="v small">${esc(w.serviceAreas.join(', '))}</div></div>
    <div class="f"><div class="lab">Completion rate</div><div class="v">${esc(w.completionRate)}%</div></div>
  </div>
  ${secondary ? `<div class="prow"><div class="lab">Secondary skills</div><div class="v">${esc(w.secondarySkills.join(', '))}</div></div>` : ''}
  <div class="skills">
    <div class="f"><div class="lab">Cooperative-verified skills</div>
      <ul>${skills}</ul>
    </div>
  </div>
  ${bio}
  <div class="foot">
    <div class="issuer">
      <b>Issued by</b><br/>
      ${esc(cooperative.name)}<br/>
      Portable across participating cooperatives · GigSetu Network
    </div>
    <div>
      <div class="qr" aria-hidden="true">${QR_ROWS.flatMap((row) => row.split('').map((c) => `<span class="${c === '1' ? 'on' : ''}"></span>`)).join('')}</div>
      <p class="qr-label">Scan-verify (prototype)</p>
    </div>
  </div>
  <div class="note">Digital Skill Passport — portable worker identity with consent-based data sharing. Sensitive personal data is never exposed.<br/>SIH prototype · synthetic data · designed for authorized integration. Not a government document.</div>
  <div class="foil" aria-hidden="true"></div>
</div></body></html>`
}

function downloadPassportHtml(w: WorkerDTO, cooperative: { name: string; regNo: string }): void {
  const blob = new Blob([passportHtml(w, cooperative)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `skill-passport-${w.name.toLowerCase().replace(/\s+/g, '-')}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Print/export actions rendered under the in-app passport document. */
export function PassportActions({ worker, cooperative }: { worker: WorkerDTO; cooperative: { name: string; regNo: string } }) {
  const { toast } = useToast()
  const lang = useAppStore((s) => s.lang)
  function print() {
    const w = window.open('', '_blank', 'width=520,height=760')
    if (w) {
      w.document.open()
      w.document.write(passportHtml(worker, cooperative))
      w.document.close()
      w.setTimeout(() => { try { w.print() } catch { /* headless / blocked */ } }, 250)
      toast({ title: t('passportPrinted', lang), description: t('passportPrintSub', lang) })
    } else {
      try {
        downloadPassportHtml(worker, cooperative)
        toast({ title: t('passportDownloaded', lang), description: t('passportDownloadSub', lang) })
      } catch {
        toast({ title: t('passportExportFailed', lang), variant: 'destructive' })
      }
    }
  }
  function download() {
    try {
      downloadPassportHtml(worker, cooperative)
      toast({ title: t('passportDownloaded', lang), description: t('passportDownloadSub', lang) })
    } catch {
      toast({ title: t('passportExportFailed', lang), variant: 'destructive' })
    }
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={print}>
        <Printer className="h-3.5 w-3.5" /> {t('printPassport', lang)}
      </Button>
      <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={download}>
        <Download className="h-3.5 w-3.5" /> {t('downloadPassport', lang)}
      </Button>
    </div>
  )
}
