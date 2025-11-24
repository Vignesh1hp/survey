import { Question, QuestionOption } from '@/app/core/models/question';
import { ICONS } from '@/mocks/add-coach-mock';
import { COACH_GROUP, QUESTION_TYPE, SURVEY_TYPE, TIMING_OPTION } from '@/mocks/survey-datas';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  CustomDateFieldComponent,
  DropdownComponent,
  FormFieldWrapperComponent,
  InputComponent,
  SelectComponent,
  TextareaComponent,
} from '@Digital-mfg/mhi-ui-components';

@Component({
  selector: 'app-survey',
  imports: [
    SelectComponent,
    DropdownComponent,
    TextareaComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    FormFieldWrapperComponent,
    InputComponent,
    CustomDateFieldComponent,
  ],
  templateUrl: './survey.html',
  styleUrl: './survey.scss',
})
export class Survey {
  survey_type = SURVEY_TYPE;
  coach_group = COACH_GROUP;
  timing = TIMING_OPTION;
  question_type = QUESTION_TYPE; // dropdown options
  selectedDueDate: Date | null = null;
  searchIcon = ICONS.search;
  arrowIcon = ICONS.dropdown;
  surveyForm: FormGroup;

  questions: Question[] = [];

  isEmailEnabled = false;

  // 5 default options
  defaultOptions = [
    { value: 'never', label: 'Never' },
    { value: 'almost-never', label: 'Almost Never' },
    { value: 'rarely', label: 'Rarely' },
    { value: 'often', label: 'Often' },
    { value: 'always', label: 'Always' },
  ];

  constructor(private fb: FormBuilder) {
    this.surveyForm = this.fb.group({
      surveyType: ['', [Validators.required]],
      timing: ['', [Validators.required]],
    });
  }

  onSelectChange(value: string | string[]) {
    this.surveyForm.get('surveyType')?.setValue(value);
    this.surveyForm.get('surveyType')?.markAsTouched();
  }

  onSelectChangeTiming(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.surveyForm.get('timing')?.setValue(value);
    this.surveyForm.get('timing')?.markAsTouched();
  }

  toggleEmailNotification() {
    this.isEmailEnabled = !this.isEmailEnabled;
  }

  isOptionSelected(q: Question, label: string): boolean {
    return q.selectedDefaults.includes(label);
  }

  onDefaultOptionSelect(q: Question, label: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;

    if (q.type === 'single') {
      q.selectedDefaults = checked ? [label] : [];
    } else {
      if (checked) q.selectedDefaults.push(label);
      else q.selectedDefaults = q.selectedDefaults.filter((l) => l !== label);
    }
  }

  trackById(q: Question) {
    return q.id;
  }

  trackOption(index: number, opt: QuestionOption) {
    return opt.id;
  }

  // ADD QUESTION
  addQuestion(): void {
    if (this.questions.length >= 10) return;

    const timestamp = Date.now();

    const newQuestion: Question = {
      id: this.questions.length + 1,
      type: 'single',
      defaultAnswerEnabled: false,
      options: [
        { id: timestamp + 1, label: 'A' },
        { id: timestamp + 2, label: 'B' },
      ],

      selectedDefaults: [],
    };

    this.questions.push(newQuestion);
  }

  // CHANGE QUESTION TYPE PER QUESTION
  onQuestionTypeChange(q: Question, event: string | string[]) {
    const selected = Array.isArray(event) ? event[0] : event;

    // Find selected item directly from QUESTION_TYPE
    const item = this.question_type.find((t) => t.label === selected || t.value === selected);
    if (!item) return;

    // Convert value to internal type
    if (item.value.includes('single')) q.type = 'single';
    else if (item.value.includes('multiple')) q.type = 'multiple';
    else q.type = 'write';

    q.defaultAnswerEnabled = false;
    q.selectedDefaults = [];
  }

  // DEFAULT ANSWERS CHECKBOX
  toggleDefaultAnswers(q: Question): void {
    q.defaultAnswerEnabled = !q.defaultAnswerEnabled;
  }

  // REMOVE A QUESTION
  removeQuestion(index: number) {
    this.questions.splice(index, 1);
  }

  addOption(q: Question): void {
    if (q.options.length < 5) {
      const nextLabel = String.fromCharCode(65 + q.options.length);

      const newOption: QuestionOption = {
        id: Date.now() + Math.random(), // Unique ID
        label: nextLabel,
      };

      q.options.push(newOption);
    }
  }

  removeOption(q: Question, index: number): void {
    if (q.options.length > 2) {
      q.options.splice(index, 1);

      // Re-label A, B, C...
      q.options = q.options.map((opt, i) => ({
        ...opt,
        label: String.fromCharCode(65 + i),
      }));
    }
  }

  // due date field
  getTodayDateValue(): Date {
    return new Date();
  }
  onDateChange(value: Date | null) {
    if (!value) return; // ignore null
    this.selectedDueDate = value;
  }
}
