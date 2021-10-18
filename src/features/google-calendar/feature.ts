import { Feature, FeatureId } from '../feature';

export class GoogleCalendarFeature extends Feature {
    get featureId(): FeatureId {
        throw new Error('Method not implemented.');
    }
}
