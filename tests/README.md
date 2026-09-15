# Testes — executar com Node.js, NUNCA copiar para o Apps Script

Estes arquivos usam `require`, `vm` e `crypto` do Node.js e **não funcionam**
como `.gs` no editor do Apps Script. Se algum deles for colado lá, o projeto
apresenta `ParseError` (ex.: `Unexpected token =`) e nada funciona.

No projeto do site, copie **somente** os arquivos de `src/`, mantendo os nomes:

- `API.gs`, `Auth.gs`, `Config.gs`, `Data.gs`, `Main.gs`, `Management.gs`, `Users.gs`
- `App.html`, `Styles.html`, `index.html`
- `appsscript.json`

Não copie `tests/` nem `maintenance/` para o projeto do site.

Para rodar localmente, na raiz do repositório, com Node.js:

```
node tests/smoke.js
node tests/regression.js
node tests/integrity.js
node tests/ui.js
node tests/maintenance.js
node tests/formulario.js
node tests/quantidade-solicitada.js
```
