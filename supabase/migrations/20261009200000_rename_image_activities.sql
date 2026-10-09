-- Renames asked by Nay: "Guia de Atividades" → "Análise da Imagem Atual"
-- (the PDF moved to shared/assets/analise-da-imagem-atual.pdf, with that
-- title in its metadata) and "Imagens" → "Upload das Imagens".
update public.program_activities
  set title = 'Análise da Imagem Atual',
      description = 'Conheça como registrar e enviar as imagens que serão analisadas pela equipe.'
  where slug = 'activity-guide';
update public.program_activities
  set title = 'Upload das Imagens'
  where slug = 'initial-images';
update public.activity_guide_versions
  set pdf_url = '../shared/assets/analise-da-imagem-atual.pdf'
  where pdf_url = '../shared/assets/guia-atividades.pdf';
