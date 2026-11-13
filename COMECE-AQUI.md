# Comece aqui

1. Descompacte esta pasta onde quiser (ex.: Documentos/Projetos/odonto-saas).
2. Abra a pasta no VS Code (Arquivo > Abrir Pasta).
3. Instale a extensão **Claude Code** no VS Code e faça login com sua conta Claude.
4. No terminal do VS Code, rode `git init` e `git add . && git commit -m "Especificação inicial"`.
5. Crie um projeto no Supabase. Copie `.env.example` para `.env.local` e cole as chaves.
6. Abra o Claude Code e mande:

   > Leia o CLAUDE.md e o docs/SPEC.md. Me apresente o plano da Etapa 1 (Fundação) antes de executar.

7. Aprove o plano, teste o resultado no navegador e faça um commit. Só então peça a próxima etapa:

   > Implemente a Etapa 2 conforme o docs/SPEC.md. Plano primeiro.

Dicas:
- Uma etapa por vez. Não deixe avançar se a atual não estiver boa.
- Quando algo quebrar, cole o erro inteiro.
- Se o visual não agradar, diga exatamente o que mudar ou mande um print de referência.
