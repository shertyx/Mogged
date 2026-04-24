import styles from './ConsentModal.module.css';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function ConsentModal({ visible, onAccept, onDecline }: Props) {
  if (!visible) return null;
  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <h2 className={styles.title}>AI Face Analysis</h2>
        <p className={styles.body}>
          Mogged will analyze your facial features using AI to calculate your chad score.
          Your photo will be stored securely and never shared publicly.
          You can delete your data at any time.
        </p>
        <button className={styles.accept} onClick={onAccept}>I Consent</button>
        <button className={styles.decline} onClick={onDecline}>No thanks</button>
      </div>
    </div>
  );
}
