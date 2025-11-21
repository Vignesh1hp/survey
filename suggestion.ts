import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

import {
  ModalComponent,
  FormFieldWrapperComponent,
  InputComponent,
  ButtonComponent,
} from '@Digital-mfg/mhi-ui-components';
import { RecommendationList } from '../recommendation-list/recommendation-list';
import { ToastService } from '@/core/services/toast.service';
import { AppointmentService, EmployeeAppointment } from '@/core/services/appointment.service';
import { AuthService } from '@/core/services/auth.service';
import { Coach } from '@/app/core/models/coaches.models';
import {
  CreateRecommendationRequest,
  RecommendationSession,
} from '@/app/core/models/recommendation.models';
import moment from 'moment';
import { Employee } from '@/app/core/models';

@Component({
  selector: 'app-coach-recommendations',
  standalone: true,
  imports: [
    ModalComponent,
    FormsModule,
    FormFieldWrapperComponent,
    InputComponent,
    ButtonComponent,
    RecommendationList,
  ],
  templateUrl: './coach-recommendations.html',
  styleUrls: ['./coach-recommendations.scss'],
})
export class CoachRecommendations implements OnChanges {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() isCoach = false;
  @Input() isAdmin = false;
  @Input() appointment: EmployeeAppointment | null = null;
  @Input() employeeId!: number; // from parent (booked list context)
  @Input() coach!: Coach | null;
  @Input() employee: Employee | null = null;
  @Output() closed = new EventEmitter<void>();

  rowCountLimit = parseInt(process.env['FEEDBACK_FORM_ROW_COUNT'] || '10');

  canCreateRecommendation = false;

  constructor(
    private toastService: ToastService,
    private appointmentService: AppointmentService,
    private authService: AuthService,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen) {
      this.canCreateRecommendation = false;
      this.loadRecommendations();
    }

    // Update editableSession date when appointment changes
    if (changes['appointment'] && this.appointment?.startTime) {
      this.editableSession.date = moment(this.appointment.startTime).format('DD-MM-YYYY');
    }
  }

  recommendations: RecommendationSession[] = [];

  private loadRecommendations() {
    // Fetch recommendations grouped by specialization and pick the coach's specialization
    if (!this.employeeId || !this.coach?.coachDetails?.specialization?.id) {
      this.recommendations = [];
      return;
    }

    const specializationId = this.coach.coachDetails.specialization.id;

    this.appointmentService.getEmployeeRecommendationsBySpecialization(this.employeeId).subscribe({
      next: (response) => {
        if (response.status && Array.isArray(response.data)) {
          const group = response.data.find(
            (g) => g.specialization && g.specialization.id === specializationId,
          );
          this.recommendations = (group?.sessions || []) as RecommendationSession[];
          const existsForAppointment = !!(
            this.appointment?.id &&
            this.recommendations.some((s: any) => s.appointment?.id === this.appointment?.id)
          );
          this.canCreateRecommendation = !existsForAppointment;

          // Prefill advices with items from the last recommendation session
          this.prefillAdvicesFromLastSession();
        } else {
          this.recommendations = [];
          this.canCreateRecommendation = true;
          // Reset to empty advices if no recommendations
          this.editableSession.advices = [{ text: '', frequency: '', comment: '' }];
        }
      },
      error: () => {
        this.recommendations = [];
        this.canCreateRecommendation = true;
        // Reset to empty advices on error
        this.editableSession.advices = [{ text: '', frequency: '', comment: '' }];
      },
    });
  }

  editableSession = {
    date: '',
    advices: [{ text: '', frequency: '', comment: '' }] as Array<{
      text: string;
      frequency: string;
      comment: string;
    }>,
  };

  formErrors: { [key: string]: string } = {};
  isSubmitting = false;
  formSubmission: { success: boolean; message: string; data?: any } | null = null;

  close() {
    this.closed.emit();
  }

  getSessionDate(date: string): string {
    return moment(date).format('DD-MM-YYYY');
  }

  getComplianceDisplay(): string {
    const result = this.getCompliancePercentage();
    if (result === 'N/A' || result === 0) {
      return 'N/A';
    }
    return `${result}%`;
  }

  getCompliancePercentage(): number | string {
    if (this.recommendations.length === 0) return 0;

    let totalScore = 0;
    let totalCount = 0;
    let hasAnyCompliance = false; // Track if at least one item has compliance marked

    for (const session of this.recommendations) {
      if (session.recommendationItems && session.recommendationItems.length > 0) {
        for (const item of session.recommendationItems) {
          totalCount++;
          const compliance = item.compliance?.toLowerCase() || '';

          if (compliance === 'following') {
            totalScore += 1;
            hasAnyCompliance = true;
          } else if (compliance === 'partial') {
            totalScore += 0.5;
            hasAnyCompliance = true;
          } else if (compliance === 'not_following') {
            totalScore += 0;
            hasAnyCompliance = true;
          }
          // If compliance is empty/null, don't mark hasAnyCompliance and totalScore += 0
        }
      }
    }

    if (totalCount === 0) return 0;

    // If no items have compliance marked (all are empty), return "N/A"
    if (!hasAnyCompliance) {
      return 'N/A';
    }

    // Calculate and return percentage if at least one item has compliance
    return Math.round((totalScore / totalCount) * 100);
  }

  private prefillAdvicesFromLastSession() {
    if (this.recommendations.length === 0) {
      // If no recommendations, keep default empty advice
      this.editableSession.advices = [{ text: '', frequency: '', comment: '' }];
      return;
    }

    // Sessions are already fetched in descending order (most recent first)
    const lastSession = this.recommendations[0];

    // Extract recommendationItems from the last session
    if (lastSession?.recommendationItems && lastSession.recommendationItems.length > 0) {
      this.editableSession.advices = lastSession.recommendationItems.map((item) => ({
        text: item.text || '',
        frequency: item.frequency || '',
        comment: item.comment || '',
      }));
    } else {
      // If last session has no items, keep default empty advice
      this.editableSession.advices = [{ text: '', frequency: '', comment: '' }];
    }
  }

  addAdvice() {
    if (this.editableSession.advices.length < this.rowCountLimit) {
      this.editableSession.advices.push({ text: '', frequency: '', comment: '' });
    } else {
      this.toastService.show({
        message: `Maximum ${this.rowCountLimit} advices allowed.`,
        type: 'error',
        duration: 3000,
      });
    }
  }

  removeAdvice(index: number) {
    this.editableSession.advices.splice(index, 1);
  }

  onSubmit(form: NgForm) {
    // Validate fields (all three required per row)
    this.formErrors = {};
    const invalid = this.editableSession.advices.some((advice, idx) => {
      let hasError = false;
      if (!advice.text) {
        this.formErrors[`text_${idx}`] = 'Advice is required';
        hasError = true;
      }
      if (!advice.frequency) {
        this.formErrors[`frequency_${idx}`] = 'Frequency is required';
        hasError = true;
      }
      if (!advice.comment) {
        this.formErrors[`comment_${idx}`] = 'Remarks are required';
        hasError = true;
      }
      return hasError;
    });

    if (form.invalid || invalid) {
      this.toastService.show({
        message: 'Please fill all required fields',
        type: 'error',
        duration: 3000,
      });
      return;
    }

    if (!this.appointment?.id) {
      this.toastService.show({
        message: 'Missing appointment id',
        type: 'error',
        duration: 3000,
      });
      return;
    }

    const session = this.authService.getCurrentUser();
    const coachId = session?.id ? Number(session.id) : null;
    if (!coachId) {
      this.toastService.show({
        message: 'Missing coach session',
        type: 'error',
        duration: 3000,
      });
      return;
    }

    const recommendation: CreateRecommendationRequest = {
      coachId,
      employeeId: this.employeeId,
      recommendations: this.editableSession.advices.map((a) => ({
        frequency: a.frequency,
        comment: a.comment,
        text: a.text,
        compliance: '',
      })),
    };

    this.isSubmitting = true;
    this.appointmentService.createRecommendations(this.appointment?.id, recommendation).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res?.status) {
          this.toastService.show({
            message: 'Recommendations saved',
            type: 'success',
            duration: 3000,
          });
          // Reload recommendations before closing
          this.loadRecommendations();
          this.close();
        } else {
          this.toastService.show({
            message: 'Failed to save recommendations',
            type: 'error',
            duration: 3000,
          });
        }
      },
      error: () => {
        this.isSubmitting = false;
        this.toastService.show({
          message: 'Failed to save recommendations',
          type: 'error',
          duration: 3000,
        });
      },
    });
  }
}
