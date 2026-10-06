import { describe, expect, it } from 'vitest'
import evento from '@/lib/ufc.fixture.json'
import { construirDossierVelada, esVeladaImportante, metodoEs, pesoEs, veladaDesdeEvento, type Velada } from '@/lib/ufc'

// UFC 332 (03/10/2026), tal y como lo dio el scoreboard de ESPN, recortado.
const v = veladaDesdeEvento(evento)!

describe('veladas de UFC', () => {
  it('la cartelera estelar va del combate estelar hacia abajo, con pesos en español y el título', () => {
    expect(v.numerado).toBe(true)
    expect(v.estelar).toHaveLength(5)
    expect(v.estelar[0]).toMatchObject({ peso: 'peso mosca femenino', asaltos: 5, tituloEnJuego: true })
    expect(v.estelar[0].a).toMatchObject({ nombre: 'Natalia Silva', pais: 'Brasil', campeon: true, ganador: true, record: '21-5-1' })
    expect(v.estelar[1].peso).toBe('peso gallo')
    expect(v.estadio).toBe('Delta Center')
    expect(v.terminada).toBe(true)
  })
  it('qué veladas son importantes', () => {
    expect(esVeladaImportante(v).si).toBe(true)
    const fn = (cambios: Partial<Velada>): Velada => ({ ...v, numerado: false, nombre: 'UFC Fight Night: A vs. B', ...cambios })
    const sinNada = fn({ estelar: v.estelar.map((c) => ({ ...c, tituloEnJuego: false, a: { ...c.a, hispano: false }, b: { ...c.b, hispano: false } })) })
    expect(esVeladaImportante(sinNada)).toMatchObject({ si: false })
    const hispano = fn({ estelar: sinNada.estelar.map((c, i) => (i === 0 ? { ...c, a: { ...c.a, hispano: true, nombre: 'Raúl Rosas Jr.' } } : c)) })
    expect(esVeladaImportante(hispano)).toMatchObject({ si: true })
    expect(esVeladaImportante(fn({ nombre: "Dana White's Contender Series: Season 10, Week 9" })).si).toBe(false)
  })
  it('método y peso', () => {
    expect(metodoEs('Decision - Unanimous')).toBe('decisión unánime')
    expect(metodoEs('KO/TKO')).toBe('KO/TKO')
    expect(metodoEs('Submission')).toBe('sumisión')
    expect(pesoEs('W Strawweight')).toBe('peso paja femenino')
    expect(pesoEs('Light Heavyweight')).toBe('peso semipesado')
  })
  it('dossier de previa y de crónica con tarjetas de los jueces', () => {
    const pre = construirDossierVelada(v, 'previa')
    expect(pre.texto).toMatch(/^VELADA: UFC 332: Silva vs\. Wang \(evento numerado de la UFC\)\./)
    expect(pre.texto).toMatch(/1\. COMBATE ESTELAR — peso mosca femenino, CON TÍTULO EN JUEGO, a 5 asaltos: Natalia Silva \(21-5-1, Brasil, campeona vigente\) contra Wang Cong/)
    expect(pre.datos).toMatchObject({ matchRef: 'mma_ufc_600061182', sport: 'ufc', home: 'Natalia Silva', away: 'Wang Cong', competicion: 'UFC' })
    const conMetodo: Velada = { ...v, estelar: v.estelar.map((c, i) => ({ ...c, metodo: i === 0 ? 'decisión unánime' : 'KO/TKO' })) }
    const cr = construirDossierVelada(conMetodo, 'cronica').texto
    expect(cr).toMatch(/1\. COMBATE ESTELAR .*: GANÓ Natalia Silva .* a Wang Cong .* por decisión unánime \(tarjetas: 48-47, 49-46, 48-47\)\./)
    expect(cr).toMatch(/2\. COESTELAR .*: GANÓ Payton Talbott .* por KO\/TKO en el asalto 1 \(2:09\)\./)
  })
})
