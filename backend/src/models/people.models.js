import mongoose from 'mongoose';

const options = { timestamps: true, versionKey: false };
const companyField = { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true };

const departmentSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, description: String, companyId: companyField, responsibleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' } }, options);
const employeeSchema = new mongoose.Schema({ firstName: { type: String, required: true, trim: true }, lastName: { type: String, required: true, trim: true }, email: { type: String, required: true, lowercase: true, trim: true }, phone: String, position: { type: String, required: true, trim: true }, departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }, companyId: companyField, hireDate: { type: Date, required: true }, status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' } }, options);
const leadSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, email: String, phone: String, source: String, companyId: companyField, status: { type: String, enum: ['NEW', 'CONTACTED', 'CONVERTED', 'LOST'], default: 'NEW' } }, options);
const opportunitySchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }, amount: { type: Number, min: 0, default: 0 }, companyId: companyField, status: { type: String, enum: ['OPEN', 'WON', 'LOST'], default: 'OPEN' } }, options);
const projectSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, description: String, companyId: companyField, responsibleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, startDate: Date, endDate: Date, status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], default: 'PENDING' }, priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' }, progress: { type: Number, min: 0, max: 100, default: 0 } }, options);
const taskSchema = new mongoose.Schema({ title: { type: String, required: true, trim: true }, description: String, projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true }, companyId: companyField, assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, dueDate: Date, status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], default: 'PENDING' }, priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' } }, options);

departmentSchema.index({ companyId: 1, name: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, email: 1 });
leadSchema.index({ companyId: 1, status: 1 });
opportunitySchema.index({ companyId: 1, status: 1 });
projectSchema.index({ companyId: 1, status: 1 });
taskSchema.index({ companyId: 1, projectId: 1, status: 1 });

export const Department = mongoose.models.Department ?? mongoose.model('Department', departmentSchema);
export const Employee = mongoose.models.Employee ?? mongoose.model('Employee', employeeSchema);
export const Lead = mongoose.models.Lead ?? mongoose.model('Lead', leadSchema);
export const Opportunity = mongoose.models.Opportunity ?? mongoose.model('Opportunity', opportunitySchema);
export const Project = mongoose.models.Project ?? mongoose.model('Project', projectSchema);
export const Task = mongoose.models.Task ?? mongoose.model('Task', taskSchema);