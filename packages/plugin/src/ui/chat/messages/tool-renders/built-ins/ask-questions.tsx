import React, { useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { AskQuestionsQuestion, AskQuestionsAnswers } from "../../../../../../../agent/src";
import type { ToolRecord, ToolRendererContext } from "../index";
import { TextShimmer } from "../../../../components/text-shimmer";
import { useChatPanel } from "../../../chat-panel/context";
import { lang } from "../../../../../i18n";
import css from "../render.less";

type DraftAnswer = { selected: string[]; otherText: string; optionInputs: Record<string, string> };
type RenderOption = AskQuestionsQuestion["options"][number] & { isOther?: boolean };

// 仅将完整的兜底选项识别为“其他”。不要用子串匹配，否则“其他模型”等普通选项会被误判。
const OTHER_LIKE_OPTION_PATTERN = /^(?:其他|其它|其余|别的|未(?:列出|涵盖)|(?:上述|以上)(?:之外|以外|均?不|都不|没有)|(?:均|都)不适用|(?:没有|无)合适|自定义|自由填写|自行(?:填写|输入)|任意(?:填写|输入)|(?:补充|填写|输入)(?:说明|内容|选项)?|other|something\s+else|custom|none\s+of\s+the\s+above|none\s+of\s+these)$/i;

function isOtherLikeOption(label: string): boolean {
  return OTHER_LIKE_OPTION_PATTERN.test(label.trim());
}

function getRenderOptions(question: AskQuestionsQuestion): RenderOption[] {
  const marked = question.options.map((option) => ({ ...option, isOther: isOtherLikeOption(option.label) }));
  if (marked.some((option) => option.isOther)) return marked;
  // 多选题不追加自由输入；单选题已有补充说明入口时也不追加，避免出现两个自由文本入口。
  if (question.multiSelect || marked.some((option) => option.input)) return marked;
  return [...marked, { label: lang.askQuestions.otherOption(), description: lang.askQuestions.otherOptionDescription(), isOther: true }];
}

function getAnswers(tool: ToolRecord): AskQuestionsAnswers | null {
  const answers = tool.result?.metadata?.answers;
  return answers && typeof answers === "object" ? answers as AskQuestionsAnswers : null;
}

function formatAnswer(answer: string | string[]): string {
  return Array.isArray(answer) ? answer.join("、") : answer;
}

export function AskQuestionsRenderer(tool: ToolRecord, { submit, turn }: ToolRendererContext) {
  // 正常的 tool:call 会清除 argsContent 并写入完整 args；解析失败时保留原文，避免半截参数进入交互态。
  // 准备阶段不能让半截参数占用 Sender，也不能展示半截的问题或选项。
  const preparing = tool.status === "pending" && tool.argsContent !== undefined;
  const questions: AskQuestionsQuestion[] = !preparing && Array.isArray(tool.args?.questions) ? tool.args.questions : [];
  const [drafts, setDrafts] = useState<Record<number, DraftAnswer>>({});
  const [skippedSteps, setSkippedSteps] = useState<number[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  // 提交后（尤其远端 Browser Task 尚未下发时）submit() 的 Promise 可能会挂起一段时间，
  // 这里在操作区右侧展示“提交中”，避免用户误以为点击无效而重复操作。
  const [submittingAction, setSubmittingAction] = useState<"confirm" | null>(null);
  const submitting = submittingAction !== null;
  const answers = useMemo(() => getAnswers(tool), [tool.result?.metadata]);
  const pending = tool.status === "pending";
  const waitingForAnswer = pending && !preparing;
  const { blockingToolSlot } = useChatPanel();
  const blockingToolTarget = blockingToolSlot?.target;
  const setBlockingToolActive = blockingToolSlot?.setActive;
  useLayoutEffect(() => {
    if (!waitingForAnswer || !blockingToolTarget || !setBlockingToolActive) return;
    setBlockingToolActive(tool.callId, true);
    return () => setBlockingToolActive(tool.callId, false);
  }, [waitingForAnswer, blockingToolTarget, setBlockingToolActive, tool.callId]);
  const cancelled = tool.status === "error" && turn?.status === "abort";
  const skipped = tool.result?.metadata?.skipped === true;
  const title = lang.askQuestions.title();
  const multiStep = questions.length > 1;

  const getDraft = (index: number): DraftAnswer => drafts[index] ?? { selected: [], otherText: "", optionInputs: {} };
  const updateDraft = (index: number, updater: (current: DraftAnswer) => DraftAnswer) => {
    setDrafts((current) => ({ ...current, [index]: updater(current[index] ?? { selected: [], otherText: "", optionInputs: {} }) }));
  };

  const toggleOption = (question: AskQuestionsQuestion, questionIndex: number, label: string) => {
    updateDraft(questionIndex, (current) => {
      if (!question.multiSelect) return { ...current, selected: [label], otherText: "" };
      const selected = current.selected.includes(label)
        ? current.selected.filter((item) => item !== label)
        : [...current.selected, label];
      return { ...current, selected };
    });
  };

  const isStepAnswered = (index: number) => {
    const draft = getDraft(index);
    return draft.selected.length > 0 || draft.otherText.trim().length > 0;
  };

  const canProceed = isStepAnswered(currentStep);
  const isLastStep = currentStep === questions.length - 1;

  const submitAnswers = (skipped: number[]) => {
    const result: AskQuestionsAnswers = {};
    questions.forEach((question, index) => {
      if (skipped.includes(index)) {
        result[question.question] = lang.askQuestions.skipped();
        return;
      }
        const draft = getDraft(index);
        const values = [
          ...draft.selected.map((label) => {
            const input = draft.optionInputs[label]?.trim();
            return input ? `${label}：${input}` : label;
          }),
          ...(draft.otherText.trim() ? [draft.otherText.trim()] : []),
        ];
        result[question.question] = question.multiSelect ? values : values[0];
    });
    setSubmittingAction("confirm");
    submit(result).finally(() => setSubmittingAction(null));
  };

  const handleNext = () => {
    if (!canProceed || submitting) return;
    const nextSkippedSteps = skippedSteps.filter((index) => index !== currentStep);
    setSkippedSteps(nextSkippedSteps);
    if (isLastStep) {
      submitAnswers(nextSkippedSteps);
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    if (submitting) return;
    const nextSkippedSteps = skippedSteps.includes(currentStep)
      ? skippedSteps
      : [...skippedSteps, currentStep];
    setSkippedSteps(nextSkippedSteps);
    if (isLastStep) {
      submitAnswers(nextSkippedSteps);
    } else {
      setCurrentStep((s) => s + 1);
    }
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
    <div className={`${css["ask-question-card"]} ${waitingForAnswer && blockingToolTarget ? css["ask-question-card-in-sender"] : ""}`}>
      <div className={css["ask-question-toolbar"]}>
        <span className={css["ask-question-command"]}>{title}</span>
        <span className={css["ask-question-state"]}>{waitingForAnswer ? lang.askQuestions.waitingForSelection() : lang.askQuestions.preparing()}</span>
      </div>
      {multiStep && questions.length > 0 && (
        <div className={css["ask-question-progress"]}>
          {questions.map((question, index) => (
            <React.Fragment key={question.question}>
              <span
                className={`${css["ask-question-progress-item"]} ${index === currentStep ? css["ask-question-progress-item-current"] : ""} ${index < currentStep ? css["ask-question-progress-item-completed"] : ""}`}
              >
                {question.header}
              </span>
              {index < questions.length - 1 && <span className={css["ask-question-progress-separator"]}>›</span>}
            </React.Fragment>
          ))}
        </div>
      )}
      {questions.length === 0 && <div className={css["ask-question-loading"]}><TextShimmer>{lang.askQuestions.preparingQuestions()}</TextShimmer></div>}
      {currentQuestion && (
        <section className={css["ask-question-item"]} key={currentQuestion.question}>
          <div className={css["ask-question-header"]}>
            <span className={css["ask-question-question"]}>{currentQuestion.question}</span>
          </div>
          <div className={css["ask-question-options"]}>
            {getRenderOptions(currentQuestion).map((option) => {
              const draft = getDraft(currentStep);
              const selected = draft.selected.includes(option.label);
              const optionInput = draft.optionInputs[option.label] ?? "";
              return (
                <React.Fragment key={option.label}>
                  {option.isOther ? (
                    <input
                      aria-label={option.label}
                      className={css["ask-question-other-input"]}
                      value={draft.otherText}
                      placeholder={option.description?.trim() || lang.askQuestions.otherPlaceholder()}
                      disabled={submitting}
                      onChange={(event) => updateDraft(currentStep, (current) => ({
                        ...current,
                        selected: !currentQuestion.multiSelect && event.target.value.trim() ? [] : current.selected,
                        otherText: event.target.value,
                      }))}
                      onKeyDown={(event) => { if (event.key === "Enter") handleNext(); }}
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`${css["ask-question-option"]} ${selected ? css["ask-question-option-selected"] : ""}`}
                        disabled={submitting}
                        onClick={() => toggleOption(currentQuestion, currentStep, option.label)}
                      >
                        <span className={css["ask-question-option-label"]}>{option.label}</span>
                        {option.description && <span className={css["ask-question-option-description"]}>{option.description}</span>}
                      </button>
                      {option.input && (
                        <input
                          aria-label={lang.askQuestions.additionalDescription(option.label)}
                          className={css["ask-question-other-input"]}
                          value={optionInput}
                          placeholder={option.inputPlaceholder?.trim() || option.description?.trim() || lang.askQuestions.otherPlaceholder()}
                          disabled={submitting}
                          onChange={(event) => updateDraft(currentStep, (current) => {
                            const text = event.target.value;
                            const selected = text.trim()
                              ? (currentQuestion.multiSelect
                                ? (current.selected.includes(option.label) ? current.selected : [...current.selected, option.label])
                                : [option.label])
                              : current.selected;
                            return {
                              ...current,
                              selected,
                              otherText: !currentQuestion.multiSelect && text.trim() ? "" : current.otherText,
                              optionInputs: { ...current.optionInputs, [option.label]: text },
                            };
                          })}
                          onKeyDown={(event) => { if (event.key === "Enter") handleNext(); }}
                        />
                      )}
                    </>
                  )}
                  {!option.isOther && option.preview && selected && (
                    <pre className={css["ask-question-option-preview"]}>{option.preview}</pre>
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
              <TextShimmer>{lang.askQuestions.submitting()}</TextShimmer>
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
  return waitingForAnswer && blockingToolTarget ? createPortal(questionCard, blockingToolTarget) : questionCard;
}
