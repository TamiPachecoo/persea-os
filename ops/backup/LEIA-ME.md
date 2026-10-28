# Backup mensal da plataforma PERSEA

Copia o banco de dados (clientes, mentoradas, eventos, financeiro, logins) e todos os
arquivos (fotos, contratos, documentos) para um disco criptografado (`.dmg`, AES-256)
fora do Supabase. Complementa os backups diários automáticos do plano Pro, que
**não** incluem os arquivos.

## Uma vez só (10 minutos)
1. Instale o Homebrew, se ainda não tiver: https://brew.sh
2. No Terminal: `brew install libpq`
3. Baixe esta pasta (`ops/backup`) para o Mac.
4. Dê dois cliques em `backup-persea.command`. Se o Mac bloquear, clique com o botão
   direito → Abrir. Na primeira vez ele pede:
   - **URI do banco:** Supabase → botão *Connect* → *Session pooler* → copie a URI e
     troque `[YOUR-PASSWORD]` pela senha do banco.
   - **Secret key:** Supabase → *Project Settings* → *API Keys* → *Secret key* (`sb_secret_…`).
   - **Pasta de destino:** a pasta do Google Drive no Finder (arraste para a janela).
   - **Senha dos backups:** fica guardada no Chaves do Mac. Guarde também no seu
     gerenciador de senhas: sem ela não há como abrir os backups.

A configuração fica em `~/.persea-backup.env`, legível só pelo seu usuário. Para refazer,
apague esse arquivo.

## Todo mês
Dois cliques em `backup-persea.command`. Leva poucos minutos. Ele guarda
`PERSEA-backup-AAAA-MM-DD.dmg` na pasta de destino e mantém os 12 mais recentes.

## Para abrir um backup
Dois cliques no `.dmg` e digite a senha. Dentro: `banco.dump`, `estrutura.sql`,
`arquivos/` e um `LEIA-ME.txt` com o comando de restauração.
