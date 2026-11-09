import { useEffect, useState } from 'react';
import { ArrowRight, Check, CircleHelp, LoaderCircle, RefreshCw } from 'lucide-react';
import type { Feature, Snapshot } from '../shared/contracts.ts';
import { api } from './api.ts';
import { useDraft } from './drafts.ts';
import { Dictation } from './Dictation.tsx';
import { RichText } from './RichText.tsx';
import { updatePlanWithAnswers } from './workflow.ts';

interface AnswersDraft {
  answers: Record<string, string>;
  requestId?: string;
  content?: string;
  recorded?: boolean;
}

export function ClarificationForm({
  feature,
  data,
  action,
  disabled,
}: {
  feature: Feature;
  data: Snapshot;
  action: (path: string, input: unknown) => Promise<any>;
  disabled: boolean;
}) {
  const [draft, setDraft, stored] = useDraft<AnswersDraft>(
    `tesslane:answers:${data.project.root}:${feature.id}:${feature.planRevision}`,
    { answers: {} },
  );
  const answers = draft && typeof draft.answers === 'object' && draft.answers ? draft.answers : {};
  const questions = feature.questions ?? [];
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [recorded, setRecorded] = useState(Boolean(draft.recorded));
  const [listening, setListening] = useState(false);
  useEffect(() => {
    if (submitted && !disabled && feature.status === 'blocked') {
      setSubmitted(false);
      setError(
        'The analysis stopped before the plan was updated. Your answers are saved; retry the plan update below.',
      );
    }
  }, [submitted, disabled, feature.status]);
  const answered = questions.filter(
    (q) => typeof answers[q.id] === 'string' && answers[q.id].trim(),
  ).length;
  const change = (id: string, value: string) => {
    setDraft({ answers: { ...answers, [id]: value } });
    setRecorded(false);
    setError('');
  };
  const submit = async () => {
    if (busy || answered !== questions.length) return;
    setBusy(true);
    setError('');
    const content =
      `Decisions for plan revision ${feature.planRevision}:\n\n` +
      questions.map((q) => `${q.question}\nAnswer: ${answers[q.id].trim()}`).join('\n\n');
    if (content.length > 50000) {
      setError(
        'These answers are too long to send together. Shorten them and try again; your draft is preserved.',
      );
      setBusy(false);
      return;
    }
    const requestId =
      draft.content === content && draft.requestId ? draft.requestId : crypto.randomUUID();
    let saved = Boolean((recorded || draft.recorded) && draft.content === content);
    const pending = { answers, requestId, content, recorded: saved };
    setDraft(pending);
    try {
      await updatePlanWithAnswers({
        feature,
        content,
        requestId,
        recorded: saved,
        request: (path, input) => (input === undefined ? api(path) : action(path, input)),
        onRecorded: () => {
          saved = true;
          setRecorded(true);
          setDraft({ ...pending, recorded: true });
        },
      });
      setSubmitted(true);
    } catch (e) {
      setError((saved ? 'Answers saved. ' : '') + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const locked = disabled || busy || submitted;
  return (
    <section
      className="clarification-form"
      id="feature-questions"
      tabIndex={-1}
      aria-labelledby="questions-heading"
    >
      <div className="decision-heading">
        <span className="decision-symbol">
          <CircleHelp size={22} />
        </span>
        <div>
          <h2 id="questions-heading">A few decisions to move forward</h2>
          <p>Answer here. Tesslane will update this feature’s plan for your review.</p>
        </div>
      </div>
      <div className="answers-progress" role="status">
        <span>
          {submitted
            ? 'Answers saved · updating the plan'
            : `${answered} of ${questions.length} answered`}
        </span>
        <span>{stored ? 'Draft saved on this device' : 'Draft kept in this tab'}</span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {questions.map((q, i) => (
          <div className="decision-question" key={q.id}>
            <div className="question-title">
              <span className={'question-number ' + (answers[q.id]?.trim() ? 'answered' : '')}>
                {answers[q.id]?.trim() ? <Check size={14} /> : i + 1}
              </span>
              <label htmlFor={'answer-' + q.id}>{q.question}</label>
            </div>
            {q.recommendation && (
              <div className="recommendation">
                <span>Recommended approach</span>
                <RichText text={q.recommendation} />
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => change(q.id, q.recommendation)}
                >
                  <Check size={14} />
                  Use this recommendation
                </button>
              </div>
            )}
            <textarea
              id={'answer-' + q.id}
              aria-label={`Answer ${i + 1}: ${q.question}`}
              required
              rows={3}
              maxLength={Math.max(1, Math.floor(40000 / questions.length))}
              disabled={locked}
              value={typeof answers[q.id] === 'string' ? answers[q.id] : ''}
              onChange={(event) => change(q.id, event.target.value)}
              placeholder="Your decision, or anything you want to adjust…"
            />
            <Dictation
              disabled={locked || listening}
              onListening={setListening}
              append={(text) => change(q.id, [answers[q.id], text].filter(Boolean).join(' '))}
            />
          </div>
        ))}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {feature.status === 'blocked' && !recorded && (
          <p className="muted">
            The previous analysis failed. Your draft is preserved. Retry the analysis before
            submitting new decisions.
          </p>
        )}
        <div className="decision-footer">
          <p>
            {submitted
              ? 'You can follow the analysis above. Execution has not started.'
              : 'This updates the plan only. You will review it before execution.'}
          </p>
          <button
            className="primary"
            disabled={
              locked ||
              listening ||
              answered !== questions.length ||
              (feature.status !== 'clarifying' && !recorded)
            }
          >
            {busy ? (
              <LoaderCircle size={16} />
            ) : recorded ? (
              <RefreshCw size={16} />
            ) : (
              <ArrowRight size={16} />
            )}
            {busy
              ? 'Updating plan…'
              : submitted
                ? 'Plan update started'
                : recorded
                  ? 'Retry plan update'
                  : 'Save answers & update plan'}
          </button>
        </div>
      </form>
    </section>
  );
}
