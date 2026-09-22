import React, { useMemo, useState } from "react";
import type { AskQuestionsQuestion, AskQuestionsAnswers } from "../../../../../../../agent/src";
import type { ToolRecord, ToolRendererContext } from "../index";
import { TextShimmer } from "../../../../components/text-shimmer";
import css from "../render.less";

type DraftAnswer = { selected: string[]; other: boolean; otherText: string };

function getAnswers(tool: ToolRecord): AskQuestionsAnswers | null {
  const answers = tool.result?.metadata?.answers;
  return answers && typeof answers === "object" ? answers as AskQuestionsAnswers : null;
}

function formatAnswer(answer: string | string[]): string {
  return Array.isArray(answer) ? answer.join("、") : answer;
}

export function AskQuestionsRenderer(tool: ToolRecord, { submit, cancel, turn }: ToolRendererContext) {
  const questions: AskQuestionsQuestion[] = Array.isArray(tool.args?.questions) ? tool.args.questions : [];
  const [drafts, setDrafts] = useState<Record<number, DraftAnswer>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const answers = useMemo(() => getAnswers(tool), [tool.result?.metadata]);
  const pending = tool.status === "pending";
  const cancelled = tool.status === "error" && turn?.status === "abort";
  const title = "以下问题需要你确认一下";
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
    if (!canProceed) return;
    if (isLastStep) {
      const result: AskQuestionsAnswers = {};
      questions.forEach((question, index) => {
        const draft = getDraft(index);
        const values = [...draft.selected, ...(draft.other ? [draft.otherText.trim()] : [])];
        result[question.question] = question.multiSelect ? values : values[0];
      });
      submit(result);
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  if (!pending) {
    if (tool.status === "error" && !cancelled && !answers) return null;
    return (
      <div className={css["ask-question-card"]}>
        <div className={css["ask-question-toolbar"]}>
          <span className={css["ask-question-command"]}>{answers ? "已收到你的选择" : title}</span>
          <span className={css["ask-question-state"]}>{tool.status === "success" ? "已完成" : cancelled ? "已取消" : "未完成"}</span>
        </div>
        {questions.map((question) => (
          <div className={css["ask-question-result"]} key={question.question}>
            <span>{question.question}</span>
            {answers ? <strong>{formatAnswer(answers[question.question] ?? "未回答")}</strong> : cancelled ? <em>未作答</em> : null}
          </div>
        ))}
        {cancelled ? <div className={css["ask-question-cancelled-note"]}>此次提问已取消，未提交选择。</div> : null}
      </div>
    );
  }

  const currentQuestion = questions[currentStep];

  return (
    <div className={css["ask-question-card"]}>
      <div className={css["ask-question-toolbar"]}>
        <span className={css["ask-question-command"]}>{title}</span>
        <span className={css["ask-question-state"]}>{questions.length > 0 ? "等待选择" : "正在准备"}</span>
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
      {questions.length === 0 && <div className={css["ask-question-loading"]}><TextShimmer>正在准备问题…</TextShimmer></div>}
      {currentQuestion && (
        <section className={css["ask-question-item"]} key={currentQuestion.question}>
          <div className={css["ask-question-header"]}>
            <span className={css["ask-question-chip"]}>{currentQuestion.header}</span>
            <span className={css["ask-question-question"]}>{currentQuestion.question}</span>
          </div>
          <div className={css["ask-question-options"]}>
            {currentQuestion.options.map((option) => {
              const draft = getDraft(currentStep);
              const selected = draft.selected.includes(option.label);
              return (
                <button
                  type="button"
                  className={`${css["ask-question-option"]} ${selected ? css["ask-question-option-selected"] : ""}`}
                  key={option.label}
                  onClick={() => toggleOption(currentQuestion, currentStep, option.label)}
                >
                  <span className={css["ask-question-option-label"]}>{option.label}</span>
                  <span className={css["ask-question-option-description"]}>{option.description}</span>
                </button>
              );
            })}
            {(() => {
              const draft = getDraft(currentStep);
              return (
                <>
                  <button
                    type="button"
                    className={`${css["ask-question-option"]} ${draft.other ? css["ask-question-option-selected"] : ""}`}
                    onClick={() => toggleOther(currentQuestion, currentStep)}
                  >
                    <span className={css["ask-question-option-label"]}>其他</span>
                    <span className={css["ask-question-option-description"]}>你有其他想法</span>
                  </button>
                  {draft.other && (
                    <input
                      className={css["ask-question-other-input"]}
                      value={draft.otherText}
                      placeholder="说说你的想法"
                      onChange={(event) => updateDraft(currentStep, (current) => ({ ...current, otherText: event.target.value }))}
                      onKeyDown={(event) => { if (event.key === "Enter") handleNext(); }}
                    />
                  )}
                </>
              );
            })()}
          </div>
        </section>
      )}
      {questions.length > 0 && (
        <div className={css["ask-question-actions"]}>
          <button type="button" className={css["ask-question-cancel"]} onClick={cancel}>取消</button>
          {multiStep && currentStep > 0 && (
            <button type="button" className={css["ask-question-back"]} onClick={() => setCurrentStep((s) => s - 1)}>上一题</button>
          )}
          <button type="button" className={css["ask-question-submit"]} disabled={!canProceed} onClick={handleNext}>
            {isLastStep ? "确认选择" : "下一题"}
          </button>
        </div>
      )}
    </div>
  );
}
