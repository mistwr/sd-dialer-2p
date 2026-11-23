// SD Dialer → Google Drive: guarda as gravações das chamadas do robot na tua pasta.
// 1) Cola este código em script.google.com (Novo projeto), guarda.
// 2) Escolhe a função "configurar" e carrega em Executar (autoriza o acesso ao Drive).
// A partir daí corre sozinho de 15 em 15 minutos.

const PASTA_ID = '16Rxejy-UmU3mA9Ei1NfhkPBrpp3ZKl6L';
const API = 'https://imaginative-flan-e3a8a5.netlify.app/api/voice-calls/export-drive';
const TOKEN = '5dda0282885c774defd8419fb52d852099405177a33f960b';
const INICIO = '2026-11-23T18:50:00Z'; // primeira gravação no Supabase novo

function configurar() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('guardarGravacoes').timeBased().everyMinutes(15).create();
  guardarGravacoes();
}

function guardarGravacoes() {
  const props = PropertiesService.getScriptProperties();
  let since = props.getProperty('since') || INICIO;
  const raiz = DriveApp.getFolderById(PASTA_ID);

  for (let ronda = 0; ronda < 10; ronda++) {
    const url = API + '?limit=40&since=' + encodeURIComponent(since) + '&token=' + TOKEN;
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) { console.log('Erro API ' + resp.getResponseCode()); return; }
    const items = JSON.parse(resp.getContentText()).items || [];
    if (!items.length) return;

    for (const it of items) {
      if (!it.url) { since = it.ended_at; continue; }
      const audio = UrlFetchApp.fetch(it.url, { muteHttpExceptions: true });
      if (audio.getResponseCode() !== 200) {
        // Ficheiro ainda não disponível: tenta outra vez na próxima execução.
        if (Date.now() - new Date(it.ended_at).getTime() < 60 * 60 * 1000) { props.setProperty('since', since); return; }
        since = it.ended_at; continue; // passou mais de 1 h: não existe, segue.
      }
      const quando = Utilities.formatDate(new Date(it.ended_at), 'Europe/Lisbon', 'yyyy-MM-dd HH-mm');
      const dia = quando.slice(0, 10);
      const pasta = pastaDoDia(raiz, dia);
      const nome = [quando, (it.client_name || 'Sem nome').replace(/[\\/:*?"<>|]/g, ''), it.phone || '', it.interest || it.status || '']
        .filter(Boolean).join(' - ') + '.ogg';
      if (!pasta.getFilesByName(nome).hasNext()) {
        pasta.createFile(audio.getBlob().setName(nome).setContentType('audio/ogg'));
      }
      since = it.ended_at;
      props.setProperty('since', since);
    }
    if (items.length < 40) return;
  }
}

function pastaDoDia(raiz, dia) {
  const it = raiz.getFoldersByName(dia);
  return it.hasNext() ? it.next() : raiz.createFolder(dia);
}
