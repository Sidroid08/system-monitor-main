import axios from 'axios';
const GRAFANA_URL = 'http://cloud-ventur-grafana:3000';
const GRAFANA_AUTH = Buffer.from('admin:admin123').toString('base64');
const grafana = axios.create({ baseURL: GRAFANA_URL, headers: { Authorization: `Basic ${GRAFANA_AUTH}` } });

async function cleanGrafana() {
  try {
    const { data: rules } = await grafana.get('/api/v1/provisioning/alert-rules');
    for (const rule of rules) {
      console.log('Deleting Grafana rule:', rule.uid);
      await grafana.delete(`/api/v1/provisioning/alert-rules/${rule.uid}`);
    }
  } catch(e) { console.log('Rules err:', e.message); }
  
  try {
    const { data: contacts } = await grafana.get('/api/v1/provisioning/contact-points');
    for (const contact of contacts) {
      if (contact.name !== 'grafana-default-email') {
        console.log('Deleting contact:', contact.uid);
        await grafana.delete(`/api/v1/provisioning/contact-points/${contact.uid}`);
      }
    }
  } catch(e) { console.log('Contacts err:', e.message); }
}
cleanGrafana().catch(console.error);
