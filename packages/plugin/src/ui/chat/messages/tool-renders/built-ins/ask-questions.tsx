import React, { useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { AskQuestionsQuestion, AskQuestionsAnswers } from "../../../../../../../agent/src";
import type { ToolRecord, ToolRendererContext } from "../index";
import { TextShimmer } from "../../../../components/text-shimmer";
import { useChatPanel } from "../../../chat-panel/context";
import { lang } from "../../../../../i18n";
import css from "../render.less";

type DraftAnswer = { selected: string[]; other: boolean; otherText: string };
type RenderOption = AskQuestionsQuestion["options"][number] & { isOther?: boolean };

// 仅将完整的兜底选项识别为“其他”。不要用子串匹配，否则“其他模型”等普通选项会被误判。
const OTHER_LIKE_OPTION_PATTERN = /^(?:其他|其它|其余|别的|未(?:列出|涵盖)|(?:上述|以上)(?:之外|以外|均?不|都不|没有)|(?:均|都)不适用|(?:没有|无)合适|自定义|自由填写|自行(?:填写|输入)|任意(?:填写|输入)|(?:补充|填写|输入)(?:说明|内容|选项)?|other|something\s+else|custom|none\s+of\s+the\s+above|none\s+of\s+these)$/i;

function isOtherLikeOption(label: string): boolean {
  return OTHER_LIKE_OPTION_PATTERN.test(label.trim());
}

function getRenderOptions(options: AskQuestionsQuestion["options"]): RenderOption[] {
  const otherIndex = options.findIndex((option) => isOtherLikeOption(option.label));
  if (otherIndex >= 0) {
    return options.map((option, index) => ({ ...option, isOther: index === otherIndex }));
  }
  return [...options, { label: lang.askQuestions.otherOption(), description: lang.askQuestions.otherOptionDescription(), isOther: true }];
}

function getAnswers(tool: ToolRecord): AskQuestionsAnswers | null {
  const answers = tool.result?.metadata?.answers;
  return answers && typeof answers === "object" ? answers as AskQuestionsAnswers : null;
}

function formatAnswer(answer: string | string[]): string {
  return Array.isArray(answer) ? answer.join("、") : answer;
}

export function AskQuestionsRenderer(tool: ToolRecord, { submit, turn }: ToolRendererContext) {
  const questions: AskQuestionsQuestion[] = Array.isArray(tool.args?.questions) ? tool.args.questions : [];
  const [drafts, setDrafts] = useState<Record<number, DraftAnswer>>({});
  const [currentStep, setCurrentStep] = useState(0);
  // 提交后（尤其远端 Browser Task 尚未下发时）submit() 的 Promise 可能会挂起一段时间，
  // 这里在操作区右侧展示“提交中/跳过中”，避免用户误以为点击无效而重复操作。
  const [submittingAction, setSubmittingAction] = useState<"confirm" | "skip" | null>(null);
  const submitting = submittingAction !== null;
  const answers = useMemo(() => getAnswers(tool), [tool.result?.metadata]);
  const pending = tool.status === "pending";
  const { blockingToolSlot } = useChatPanel();
  const blockingToolTarget = blockingToolSlot?.target;
  const setBlockingToolActive = blockingToolSlot?.setActive;
  useLayoutEffect(() => {
    if (!pending || !blockingToolTarget || !setBlockingToolActive) return;
    setBlockingToolActive(tool.callId, true);
    return () => setBlockingToolActive(tool.callId, false);
  }, [pending, blockingToolTarget, setBlockingToolActive, tool.callId]);
  const cancelled = tool.status === "error" && turn?.status === "abort";
  const skipped = tool.result?.metadata?.skipped === true;
  const title = lang.askQuestions.title();
  const multiStep = questions.length > 1;

  const getDraft = (index: number): DraftAnswer => drafts[index] ?? { selected: [], other: false, otherText: "" };
  const updateDraft = (index: number, updater: (current: DraftAnswer) => DraftAnswer) => {
    setDrafts((current) => ({ ...current, [index]: updater(current[index] ?? { selected: [], other: false, otherText: "" }) }));
  };

  const toggleOption = (question: AskQuestionsQuestion, questionIndex: number, label: string) => {
    updateDraft(questionIndex, (current) => {
      if (!question.multiSelect) return { ...current, selected: [label], other: false };
      const selected = current.selected.includes(label)
        ? current.selected.filter((item) => item !== label)
        : [...current.selected, label];
      return { ...current, selected };
    });
  };

  const toggleOther = (question: AskQuestionsQuestion, questionIndex: number) => {
    updateDraft(questionIndex, (current) => ({
      ...current,
      selected: question.multiSelect ? current.selected : [],
      other: !current.other,
    }));
  };

  const isStepAnswered = (index: number) => {
    const draft = getDraft(index);
    return draft.selected.length > 0 || (draft.other && draft.otherText.trim().length > 0);
  };

  const canProceed = isStepAnswered(currentStep);
  const isLastStep = currentStep === questions.length - 1;

  const handleNext = () => {
    if (!canProceed || submitting) return;
    if (isLastStep) {
      const result: AskQuestionsAnswers = {};
      questions.forEach((question, index) => {
        const draft = getDraft(index);
        const values = [
          ...draft.selected,
          ...(draft.other ? [draft.otherText.trim()] : []),
        ];
        result[question.question] = question.multiSelect ? values : values[0];
      });
      setSubmittingAction("confirm");
      submit(result).finally(() => setSubmittingAction(null));
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    if (submitting) return;
    setSubmittingAction("skip");
    submit({ skipped: true }).finally(() => setSubmittingAction(null));
  };

  if (!pending) {
    if (tool.status === "error" && !cancelled && !answers) return null;
    return (
      <div className={css["ask-question-card"]}>
        <div className={css["ask-question-toolbar"]}>
          <span className={css["ask-question-command"]}>{skipped ? lang.askQuestions.skippedPrompt() : answers ? lang.askQuestions.answersReceived() : title}</span>
          <span className={css["ask-question-state"]}>{skipped ? lang.askQuestions.skipped() : tool.status === "success" ? lang.askQuestions.completed() : cancelled ? lang.askQuestions.cancelled() : lang.askQuestions.incomplete()}</span>
        </div>
        {questions.map((question) => (
          <div className={css["ask-question-result"]} key={question.question}>
            <span>{question.question}</span>
            {answers ? <strong>{formatAnswer(answers[question.question] ?? lang.askQuestions.unanswered())}</strong> : skipped ? <em>{lang.askQuestions.skipped()}</em> : cancelled ? <em>{lang.askQuestions.notAnswered()}</em> : null}
          </div>
        ))}
        {cancelled ? <div className={css["ask-question-cancelled-note"]}>{lang.askQuestions.cancelledNote()}</div> : null}
      </div>
    );
  }

  const currentQuestion = questions[currentStep];

  const questionCard = (
    <div className={`${css["ask-question-card"]} ${blockingToolTarget ? css["ask-question-card-in-sender"] : ""}`}>
      <div className={css["ask-question-toolbar"]}>
        <span className={css["ask-question-command"]}>{title}</span>
        <span className={css["ask-question-state"]}>{questions.length > 0 ? lang.askQuestions.waitingForSelection() : lang.askQuestions.preparing()}</span>
      </div>
      {multiStep && questions.length > 0 && (
        <div className={css["ask-question-progress"]}>
          <div className={css["ask-question-progress-track"]}>
            <div
              className={css["ask-question-progress-fill"]}
              style={{ width: `${((currentStep) / questions.length) * 100}%` }}
            />
          </div>
          <span className={css["ask-question-progress-label"]}>{currentStep + 1} / {questions.length}</span>
        </div>
      )}
      {questions.length === 0 && <div className={css["ask-question-loading"]}><TextShimmer>{lang.askQuestions.preparingQuestions()}</TextShimmer></div>}
      {currentQuestion && (
        <section className={css["ask-question-item"]} key={currentQuestion.question}>
          <div className={css["ask-question-header"]}>
            <span className={css["ask-question-chip"]}>{currentQuestion.header}</span>
            <span className={css["ask-question-question"]}>{currentQuestion.question}</span>
          </div>
          <div className={css["ask-question-options"]}>
            {getRenderOptions(currentQuestion.options).map((option) => {
              const draft = getDraft(currentStep);
              const selected = option.isOther ? draft.other : draft.selected.includes(option.label);
              return (
                <React.Fragment key={option.label}>
                  <button
                    type="button"
                    className={`${css["ask-question-option"]} ${selected ? css["ask-question-option-selected"] : ""}`}
                    disabled={submitting}
                    onClick={() => (option.isOther
                      ? toggleOther(currentQuestion, currentStep)
                      : toggleOption(currentQuestion, currentStep, option.label))}
                  >
                    <span className={css["ask-question-option-label"]}>{option.label}</span>
                    <span className={css["ask-question-option-description"]}>{option.description}</span>
                  </button>
                  {option.isOther && draft.other && (
                    <input
                      className={css["ask-question-other-input"]}
                      value={draft.otherText}
                      placeholder={lang.askQuestions.otherPlaceholder()}
                      disabled={submitting}
                      onChange={(event) => updateDraft(currentStep, (current) => ({ ...current, otherText: event.target.value }))}
                      onKeyDown={(event) => { if (event.key === "Enter") handleNext(); }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </section>
      )}
      {questions.length > 0 && (
        <div className={css["ask-question-actions"]}>
          {submitting ? (
            <span className={css["ask-question-submitting"]}>
              <TextShimmer>{submittingAction === "skip" ? lang.askQuestions.skipping() : lang.askQuestions.submitting()}</TextShimmer>
            </span>
          ) : (
            <>
              <button type="button" className={css["ask-question-skip"]} onClick={handleSkip}>{lang.askQuestions.skip()}</button>
              {multiStep && currentStep > 0 && (
                <button type="button" className={css["ask-question-back"]} onClick={() => setCurrentStep((s) => s - 1)}>{lang.askQuestions.previous()}</button>
              )}
              <button type="button" className={css["ask-question-submit"]} disabled={!canProceed} onClick={handleNext}>
                {isLastStep ? lang.askQuestions.confirm() : lang.askQuestions.next()}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
  return pending && blockingToolTarget ? createPortal(questionCard, blockingToolTarget) : questionCard;
}
