import { Test, TestingModule } from '@nestjs/testing';
import { FragmentTaggerService } from '../../../src/fragments/fragment-tagger.service';

describe('FragmentTaggerService', () => {
  let service: FragmentTaggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FragmentTaggerService],
    }).compile();

    service = module.get<FragmentTaggerService>(FragmentTaggerService);
  });

  describe('tag', () => {
    it('returns empty array for empty text', () => {
      expect(service.tag('')).toEqual([]);
    });

    it('returns empty array when no keywords match', () => {
      expect(service.tag('El número 42 es la respuesta.')).toEqual([]);
    });

    it('detects amor theme from love-related keywords', () => {
      const text = 'El amor que sentía por ella era más fuerte que cualquier otra cosa.';
      const themes = service.tag(text);
      expect(themes).toContain('amor');
    });

    it('detects muerte theme from mortality keywords', () => {
      const text = 'Ante la muerte todos los hombres son iguales; el sepulcro no distingue.';
      const themes = service.tag(text);
      expect(themes).toContain('muerte');
    });

    it('detects filosofia theme from philosophical keywords', () => {
      const text = 'La virtud es el bien supremo del alma; la razón nos guía hacia la sabiduría.';
      const themes = service.tag(text);
      expect(themes).toContain('filosofia');
    });

    it('detects heroismo from combat and valor keywords', () => {
      const text = 'El héroe demostró su valentía y coraje en la batalla, logrando la victoria.';
      const themes = service.tag(text);
      expect(themes).toContain('heroismo');
    });

    it('returns at most 3 themes', () => {
      const text =
        'El amor y la muerte se entrelazan; el héroe busca la virtud y el bien supremo ' +
        'mientras navega en su viaje por el mar, con sus amigos fieles que confían en él.';
      const themes = service.tag(text);
      expect(themes.length).toBeLessThanOrEqual(3);
    });

    it('orders themes by keyword match count (most matches first)', () => {
      // amor has many keyword hits; muerte has one
      const text =
        'El amor, el amado, la amada, el corazón enamorado, la pasión y la ternura. ' +
        'También hay muerte.';
      const themes = service.tag(text);
      expect(themes[0]).toBe('amor');
    });

    it('is case-insensitive', () => {
      const text = 'AMOR Y CORAZÓN ENAMORADO.';
      const themes = service.tag(text);
      expect(themes).toContain('amor');
    });

    it('detects conocimiento from learning keywords', () => {
      const text = 'La sabiduría se adquiere con el estudio y el conocimiento de la verdad.';
      expect(service.tag(text)).toContain('conocimiento');
    });

    it('detects naturaleza from landscape keywords', () => {
      const text = 'Las olas del mar golpeaban la roca mientras el viento soplaba desde el cielo.';
      expect(service.tag(text)).toContain('naturaleza');
    });
  });
});
