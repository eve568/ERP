import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getHealth } from './src/services/api';

const modules = [
  { key: 'dashboard', label: 'Dashboard', detail: 'Resumen operativo' },
  { key: 'sales', label: 'Ventas', detail: 'Clientes y pedidos' },
  { key: 'inventory', label: 'Inventario', detail: 'Existencias y movimientos' },
  { key: 'purchases', label: 'Compras', detail: 'Proveedores y recepción' },
  { key: 'people', label: 'Personas', detail: 'RRHH, CRM y proyectos' }
];

export default function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [selectedModule, setSelectedModule] = useState('dashboard');

  useEffect(() => {
    getHealth()
      .then((payload) => setHealth(payload.data))
      .catch((requestError) => setError(requestError.message));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ERP MODULAR</Text>
            <Text style={styles.title}>Centro de operaciones</Text>
            <Text style={styles.description}>Una vista clara para cada área de la empresa.</Text>
          </View>
          <Text style={styles.platform}>{Platform.OS.toUpperCase()}</Text>
        </View>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Conexión de servicios</Text>
          {health ? <Text style={styles.statusOk}>API conectada · MongoDB {health.database}</Text> : error ? <Text style={styles.statusError}>{error}</Text> : <ActivityIndicator color="#0f766e" />}
        </View>
        <Text style={styles.sectionTitle}>Módulos</Text>
        <View style={styles.moduleGrid}>
          {modules.map((module) => (
            <Pressable key={module.key} onPress={() => setSelectedModule(module.key)} style={[styles.moduleCard, selectedModule === module.key && styles.moduleCardActive]}>
              <Text style={[styles.moduleLabel, selectedModule === module.key && styles.moduleLabelActive]}>{module.label}</Text>
              <Text style={styles.moduleDetail}>{module.detail}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.contentPanel}>
          <Text style={styles.panelEyebrow}>VISTA ACTIVA</Text>
          <Text style={styles.panelTitle}>{modules.find((module) => module.key === selectedModule)?.label}</Text>
          <Text style={styles.panelText}>El panel consumirá datos reales de la API cuando exista una sesión autenticada y MongoDB esté configurado.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f7f5' },
  container: { padding: 32, maxWidth: 980, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 24 },
  eyebrow: { color: '#0f766e', fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: '#12312d', fontSize: 38, fontWeight: '800', marginTop: 12 },
  description: { color: '#4b635e', fontSize: 17, lineHeight: 26, marginTop: 16 },
  statusCard: { backgroundColor: '#ffffff', borderColor: '#d7e4df', borderRadius: 12, borderWidth: 1, marginTop: 32, minHeight: 94, padding: 20 },
  statusLabel: { color: '#64756f', fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  statusOk: { color: '#0f766e', fontSize: 18, fontWeight: '700', marginTop: 14 },
  statusError: { color: '#b42318', fontSize: 16, marginTop: 14 },
  platform: { color: '#82918d', fontSize: 13, marginTop: 20 }
  ,sectionTitle: { color: '#12312d', fontSize: 21, fontWeight: '800', marginTop: 34 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  moduleCard: { backgroundColor: '#ffffff', borderColor: '#d7e4df', borderRadius: 10, borderWidth: 1, minWidth: 160, padding: 16, flexGrow: 1 },
  moduleCardActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  moduleLabel: { color: '#12312d', fontSize: 16, fontWeight: '700' },
  moduleLabelActive: { color: '#ffffff' },
  moduleDetail: { color: '#6b7c76', fontSize: 13, marginTop: 7 },
  contentPanel: { backgroundColor: '#12312d', borderRadius: 12, marginTop: 28, padding: 24 },
  panelEyebrow: { color: '#8bd4c6', fontSize: 12, fontWeight: '700', letterSpacing: 1.3 },
  panelTitle: { color: '#ffffff', fontSize: 28, fontWeight: '800', marginTop: 10 },
  panelText: { color: '#c9ded8', fontSize: 15, lineHeight: 23, marginTop: 10 }
});
