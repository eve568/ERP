import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AppButton from '../components/AppButton';
import AppModal from '../components/AppModal';
import EmptyBlock from '../components/EmptyBlock';
import FormActions from '../components/FormActions';
import FormField from '../components/FormField';
import PickerField from '../components/PickerField';
import { isSessionError, listExpenseRecords, listIncomeRecords } from '../services/api';
import { createExpenseRecord, createIncomeRecord } from '../services/records';
import { colors, radius, spacing, typography } from '../theme';
import { formatCurrency, formatDate } from '../utils/format';

const paymentMethods = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Crédito', value: 'CREDIT' },
];

function FinanceForm({ type, token, onCancel, onDone, onSessionExpired }) {
  const income = type === 'income';
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [category, setCategory] = useState('General');
  const [status, setStatus] = useState('PAID');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    const numericAmount = Number(amount);
    if (!concept.trim()) return setError('El concepto es obligatorio.');
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return setError('Ingresa un monto mayor a cero.');
    }
    if (!income && !category.trim()) return setError('La categoría es obligatoria.');

    setSubmitting(true);
    setError(null);
    try {
      if (income) {
        await createIncomeRecord(token, {
          concept: concept.trim(),
          amount: numericAmount,
          paymentMethod,
        });
      } else {
        await createExpenseRecord(token, {
          concept: concept.trim(),
          category: category.trim(),
          amount: numericAmount,
          status,
        });
      }
      onDone(income ? 'Ingreso registrado correctamente.' : 'Gasto registrado correctamente.');
    } catch (requestError) {
      if (isSessionError(requestError)) return onSessionExpired?.();
      setError(requestError?.message ?? 'No fue posible guardar el registro financiero.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <FormField label="Concepto" value={concept} onChangeText={setConcept} placeholder={income ? 'Ej.: Pago de servicio' : 'Ej.: Papelería'} isRequired editable={!submitting} />
      <FormField label="Monto" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" isRequired editable={!submitting} />
      {income ? (
        <PickerField label="Método de pago" value={paymentMethod} options={paymentMethods} onChange={setPaymentMethod} disabled={submitting} />
      ) : (
        <>
          <FormField label="Categoría" value={category} onChangeText={setCategory} placeholder="Ej.: Operación" isRequired editable={!submitting} />
          <PickerField label="Estado" value={status} options={[{ label: 'Pagado', value: 'PAID' }, { label: 'Pendiente', value: 'PENDING' }]} onChange={setStatus} disabled={submitting} />
        </>
      )}
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
      <FormActions onSubmit={submit} onCancel={onCancel} submitLabel="Guardar" submitting={submitting} />
    </View>
  );
}

export default function FinanceScreen({ token, companyId, refreshKey, onSessionExpired, onToast }) {
  const [tab, setTab] = useState('incomes');
  const [refreshTick, setRefreshTick] = useState(0);
  const [modal, setModal] = useState(null);
  const [state, setState] = useState({ status: 'loading', incomes: [], expenses: [], error: null });

  useEffect(() => {
    if (!companyId) {
      setState({ status: 'empty', incomes: [], expenses: [], error: null });
      return;
    }
    let cancelled = false;
    setState((current) => ({ ...current, status: 'loading', error: null }));
    Promise.all([listIncomeRecords(token, companyId), listExpenseRecords(token, companyId)])
      .then(([incomePayload, expensePayload]) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          incomes: Array.isArray(incomePayload?.data) ? incomePayload.data : [],
          expenses: Array.isArray(expensePayload?.data) ? expensePayload.data : [],
          error: null,
        });
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (isSessionError(requestError)) return onSessionExpired?.();
        setState({ status: 'error', incomes: [], expenses: [], error: requestError?.message ?? 'No se pudo cargar Finanzas.' });
      });
    return () => { cancelled = true; };
  }, [token, companyId, refreshKey, refreshTick, onSessionExpired]);

  const totals = useMemo(() => {
    const income = state.incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expenses = state.expenses
      .filter((item) => item.status !== 'CANCELLED')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { income, expenses, balance: income - expenses };
  }, [state.incomes, state.expenses]);

  const items = tab === 'incomes' ? state.incomes : state.expenses;

  function saved(message) {
    setModal(null);
    onToast?.(message, 'success');
    setRefreshTick((value) => value + 1);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.title}>Finanzas</Text>
          <Text style={styles.subtitle}>Ingresos, gastos y balance de la empresa activa</Text>
        </View>
        <View style={styles.actions}>
          <AppButton label="Nuevo ingreso" onPress={() => setModal('income')} disabled={!companyId} />
          <AppButton label="Nuevo gasto" variant="secondary" onPress={() => setModal('expense')} disabled={!companyId} />
        </View>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Ingresos</Text><Text style={styles.summaryValue}>{formatCurrency(totals.income)}</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Gastos</Text><Text style={styles.summaryValue}>{formatCurrency(totals.expenses)}</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Balance</Text><Text style={styles.summaryValue}>{formatCurrency(totals.balance)}</Text></View>
      </View>

      <View style={styles.tabs}>
        <AppButton label={`Ingresos (${state.incomes.length})`} variant={tab === 'incomes' ? 'primary' : 'secondary'} small onPress={() => setTab('incomes')} />
        <AppButton label={`Gastos (${state.expenses.length})`} variant={tab === 'expenses' ? 'primary' : 'secondary'} small onPress={() => setTab('expenses')} />
      </View>

      {state.status === 'loading' ? <View style={styles.state}><ActivityIndicator color={colors.primaryDark} /><Text style={styles.muted}>Cargando finanzas...</Text></View> : null}
      {state.status === 'error' ? <View style={styles.state}><Text style={styles.errorText}>{state.error}</Text><AppButton label="Reintentar" variant="secondary" small onPress={() => setRefreshTick((v) => v + 1)} /></View> : null}
      {state.status === 'ready' && items.length === 0 ? <EmptyBlock title={tab === 'incomes' ? 'Sin ingresos' : 'Sin gastos'} message={tab === 'incomes' ? 'Aún no hay ingresos registrados.' : 'Aún no hay gastos registrados.'} /> : null}

      {state.status === 'ready' && items.length ? (
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item._id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.concept}>{item.concept}</Text>
                <Text style={styles.meta}>{tab === 'incomes' ? paymentMethods.find((method) => method.value === item.paymentMethod)?.label ?? item.paymentMethod : `${item.category} · ${item.status === 'PAID' ? 'Pagado' : item.status === 'PENDING' ? 'Pendiente' : 'Cancelado'}`} · {item.date ? formatDate(new Date(item.date)) : 'Sin fecha'}</Text>
              </View>
              <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <AppModal visible={Boolean(modal)} title={modal === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto'} subtitle="La empresa se asigna automáticamente según la sesión activa." onClose={() => setModal(null)} maxWidth={560}>
        {modal ? <FinanceForm key={modal} type={modal} token={token} onCancel={() => setModal(null)} onDone={saved} onSessionExpired={onSessionExpired} /> : null}
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.xl },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.lg, flexWrap: 'wrap' },
  title: { color: colors.text, fontSize: typography.size.xxl, fontWeight: typography.weight.extraBold },
  subtitle: { color: colors.textSecondary, fontSize: typography.size.sm, marginTop: 6 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  summary: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  summaryCard: { flexGrow: 1, flexBasis: 220, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl },
  summaryLabel: { color: colors.textSecondary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  summaryValue: { color: colors.text, fontSize: typography.size.xl, fontWeight: typography.weight.extraBold, marginTop: spacing.sm },
  tabs: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  state: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  muted: { color: colors.textSecondary, fontSize: typography.size.sm },
  list: { gap: spacing.sm },
  row: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  rowMain: { flex: 1, minWidth: 0 },
  concept: { color: colors.text, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  meta: { color: colors.textSecondary, fontSize: typography.size.xs, marginTop: 5 },
  amount: { color: colors.text, fontSize: typography.size.md, fontWeight: typography.weight.extraBold },
  form: { gap: spacing.lg },
  errorBox: { backgroundColor: colors.pastelPink, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: typography.size.xs },
});
