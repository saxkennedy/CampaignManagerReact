import BackendApi from './BackendApi';
class AllomancyService {
    callbacks = [];

    async GetSnapChart() {
        return BackendApi.fetch(`/backendApi/allomancy/getSnapChart/${email}/${password}`);
    }

    async GetSnap(favoredClass, favoredAbility) {
        return BackendApi.fetch(`/backendApi/allomancy/getSnap/${favoredClass}/${favoredAbility}`);
    }
}

export default new AllomancyService();